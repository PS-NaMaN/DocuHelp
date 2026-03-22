import { replaceChunksForDocument, saveDocument } from './indexedDBService'
import { extractTextFromFile, getFileExtension } from './textExtractionService'
import { chunkText } from '../utils/chunkText'
import { logAndRethrow } from '../utils/logger'

/**
 * Run the full Phase 1 ingestion pipeline for uploaded documents.
 *
 * @param {File[]} uploadedFiles - Files chosen by the user for local indexing.
 * @param {(progress: {
 *   stage: string,
 *   fileName: string,
 *   current: number,
 *   total: number,
 *   message: string,
 * }) => void} [reportProgress] - Optional callback for UI progress updates.
 * @param {{ ocrScale?: number }} [settings={}] - User-configurable ingestion settings.
 * @returns {Promise<void>} Resolves after every file has been processed and stored.
 */
export async function ingestDocuments(uploadedFiles, reportProgress, settings = {}) {
  try {
    const { generateEmbeddings } = await import('./embeddingService')

    for (let fileIndex = 0; fileIndex < uploadedFiles.length; fileIndex += 1) {
      const uploadedFile = uploadedFiles[fileIndex]
      const extractedDocumentText = await extractAndValidateText(
        uploadedFile,
        fileIndex,
        uploadedFiles.length,
        reportProgress,
        settings,
      )

      const chunkRecords = createAndValidateChunks(extractedDocumentText, uploadedFile.name)
      const embeddingVectors = await generateChunkEmbeddings(
        generateEmbeddings,
        chunkRecords,
        uploadedFile,
        fileIndex,
        uploadedFiles.length,
        reportProgress,
      )

      await storeIndexedDocument(
        uploadedFile,
        chunkRecords,
        embeddingVectors,
        fileIndex,
        uploadedFiles.length,
        reportProgress,
      )
    }
  } catch (error) {
    logAndRethrow('ingestDocuments', error, {
      fileCount: uploadedFiles.length,
      ocrScale: settings.ocrScale,
    })
  }
}

/**
 * Extract text from a file and fail early when nothing useful is found.
 *
 * @param {File} uploadedFile - The file currently being processed.
 * @param {number} fileIndex - Zero-based file index in the current batch.
 * @param {number} totalFiles - Total files in the current batch.
 * @param {Function | undefined} reportProgress - Optional UI progress callback.
 * @param {{ ocrScale?: number }} settings - User-configurable ingestion settings.
 * @returns {Promise<string>} Extracted plain text ready for chunking.
 */
async function extractAndValidateText(uploadedFile, fileIndex, totalFiles, reportProgress, settings) {
  reportStageProgress(reportProgress, {
    stage: 'extracting',
    fileName: uploadedFile.name,
    current: fileIndex,
    total: totalFiles,
    message: `Extracting raw text from ${uploadedFile.name}...`,
  })

  const extractedDocumentText = await extractTextFromFile(uploadedFile, {
    onPdfOcrProgress: (ocrProgress) => {
      reportStageProgress(reportProgress, {
        stage: 'ocr',
        fileName: uploadedFile.name,
        current: fileIndex + createPageProgressRatio(ocrProgress),
        total: totalFiles,
        message: createOcrProgressMessage(uploadedFile.name, ocrProgress),
      })
    },
    ocrScale: settings.ocrScale,
  })

  if (extractedDocumentText) {
    return extractedDocumentText
  }

  throw new Error(`No readable text was found in ${uploadedFile.name}.`)
}

/**
 * Create chunk records from extracted text and fail early when chunking yields nothing.
 *
 * @param {string} extractedDocumentText - Plain text extracted from the uploaded file.
 * @param {string} fileName - Original file name for readable errors.
 * @returns {Array<{ index: number, text: string, tokenCount: number }>} Chunk records ready for embeddings.
 */
function createAndValidateChunks(extractedDocumentText, fileName) {
  const chunkRecords = chunkText(extractedDocumentText).map((chunkRecord) => ({
    ...chunkRecord,
    fileName,
  }))

  if (chunkRecords.length) {
    return chunkRecords
  }

  throw new Error(`Unable to create chunks for ${fileName}.`)
}

/**
 * Generate embeddings for every chunk while streaming progress back to the UI.
 *
 * @param {(chunks: Array<{ text: string }>, onProgress?: Function) => Promise<Float32Array[]>} generateEmbeddings - Lazy-loaded embedding generator.
 * @param {Array<{ index: number, text: string, tokenCount: number }>} chunkRecords - Chunks ready for vectorization.
 * @param {File} uploadedFile - The file currently being processed.
 * @param {number} fileIndex - Zero-based file index in the current batch.
 * @param {number} totalFiles - Total files in the current batch.
 * @param {Function | undefined} reportProgress - Optional UI progress callback.
 * @returns {Promise<Float32Array[]>} Embedding vectors in chunk order.
 */
async function generateChunkEmbeddings(
  generateEmbeddings,
  chunkRecords,
  uploadedFile,
  fileIndex,
  totalFiles,
  reportProgress,
) {
  reportStageProgress(reportProgress, {
    stage: 'embedding',
    fileName: uploadedFile.name,
    current: fileIndex,
    total: totalFiles,
    message: createEmbeddingStartMessage(chunkRecords.length),
  })

  return generateEmbeddings(chunkRecords, ({ current, total }) => {
    reportStageProgress(reportProgress, {
      stage: 'embedding',
      fileName: uploadedFile.name,
      current: fileIndex + current / Math.max(total, 1),
      total: totalFiles,
      message: createEmbeddingProgressMessage(uploadedFile.name, current, total),
    })
  })
}

/**
 * Store the document record and all associated chunk vectors in IndexedDB.
 *
 * @param {File} uploadedFile - The file currently being processed.
 * @param {Array<{ index: number, text: string, tokenCount: number }>} chunkRecords - Chunks produced from the document text.
 * @param {Float32Array[]} embeddingVectors - Vectors aligned with the chunk records.
 * @param {number} fileIndex - Zero-based file index in the current batch.
 * @param {number} totalFiles - Total files in the current batch.
 * @param {Function | undefined} reportProgress - Optional UI progress callback.
 * @returns {Promise<void>} Resolves when document and chunks are fully persisted.
 */
async function storeIndexedDocument(
  uploadedFile,
  chunkRecords,
  embeddingVectors,
  fileIndex,
  totalFiles,
  reportProgress,
) {
  const storedDocumentRecord = createStoredDocumentRecord(uploadedFile, chunkRecords, embeddingVectors)
  const documentId = await saveDocument(storedDocumentRecord)
  const persistedChunkRecords = createPersistedChunkRecords(documentId, chunkRecords, embeddingVectors)

  reportStageProgress(reportProgress, {
    stage: 'storing',
    fileName: uploadedFile.name,
    current: fileIndex,
    total: totalFiles,
    message: `Persisting ${chunkRecords.length} chunks to IndexedDB...`,
  })

  await replaceChunksForDocument(documentId, persistedChunkRecords)

  reportStageProgress(reportProgress, {
    stage: 'stored',
    fileName: uploadedFile.name,
    current: fileIndex + 1,
    total: totalFiles,
    message: `${uploadedFile.name} is now available in your local vector store.`,
  })
}

/**
 * Build the normalized document record stored in the top-level documents store.
 *
 * @param {File} uploadedFile - The file currently being indexed.
 * @param {Array<{ text: string }>} chunkRecords - Chunks derived from the file.
 * @param {Float32Array[]} embeddingVectors - Embedding vectors derived from the chunks.
 * @returns {{
 *   name: string,
 *   extension: string,
 *   mimeType: string,
 *   size: number,
 *   ingestedAt: string,
 *   chunkCount: number,
 *   embeddingDimensions: number,
 *   preview: string,
 * }} The document metadata record stored in IndexedDB.
 */
function createStoredDocumentRecord(uploadedFile, chunkRecords, embeddingVectors) {
  return {
    name: uploadedFile.name,
    extension: getFileExtension(uploadedFile.name),
    mimeType: uploadedFile.type || 'application/octet-stream',
    size: uploadedFile.size,
    ingestedAt: new Date().toISOString(),
    chunkCount: chunkRecords.length,
    embeddingDimensions: embeddingVectors[0]?.length ?? 0,
    preview: chunkRecords[0]?.text.slice(0, 220) ?? '',
  }
}

/**
 * Combine chunk text with its matching embedding so storage stays aligned.
 *
 * @param {number} documentId - IndexedDB id for the parent document record.
 * @param {Array<{ text: string, tokenCount: number }>} chunkRecords - Chunks produced from the file text.
 * @param {Float32Array[]} embeddingVectors - Embedding vectors aligned by chunk index.
 * @returns {Array<{ documentId: number, chunkIndex: number, text: string, tokenCount: number, embedding: Float32Array }>} Chunk records ready for persistence.
 */
function createPersistedChunkRecords(documentId, chunkRecords, embeddingVectors) {
  return chunkRecords.map((chunkRecord, chunkIndex) => ({
    documentId,
    fileName: chunkRecord.fileName,
    chunkIndex,
    text: chunkRecord.text,
    tokenCount: chunkRecord.tokenCount,
    embedding: embeddingVectors[chunkIndex],
  }))
}

/**
 * Format the initial embedding status message for a file.
 *
 * @param {number} chunkCount - Number of chunks awaiting embeddings.
 * @returns {string} A user-facing progress message.
 */
function createEmbeddingStartMessage(chunkCount) {
  return `Generating embeddings for ${chunkCount} chunk${chunkCount > 1 ? 's' : ''}...`
}

/**
 * Format per-chunk embedding progress for the UI.
 *
 * @param {string} fileName - Name of the file being embedded.
 * @param {number} currentChunkIndex - Zero-based chunk progress reported by the embedding pipeline.
 * @param {number} totalChunks - Total number of chunks for the file.
 * @returns {string} A user-facing progress message.
 */
function createEmbeddingProgressMessage(fileName, currentChunkIndex, totalChunks) {
  return `Embedding chunk ${Math.min(currentChunkIndex + 1, totalChunks)} of ${totalChunks} for ${fileName}...`
}

/**
 * Format OCR progress updates so the UI can explain long-running scanned-page extraction.
 *
 * @param {string} fileName - Name of the file currently being OCR'd.
 * @param {{
 *   status: string,
 *   progress: number,
 *   pageNumber: number,
 *   totalPages: number,
 * }} ocrProgress - OCR status payload from the PDF extraction layer.
 * @returns {string} A user-facing OCR progress message.
 */
function createOcrProgressMessage(fileName, ocrProgress) {
  const pageLabel = `page ${ocrProgress.pageNumber} of ${ocrProgress.totalPages}`
  const percentComplete = Math.round((ocrProgress.progress ?? 0) * 100)

  return `Running OCR for ${fileName} (${pageLabel}) - ${ocrProgress.status} (${percentComplete}%).`
}

/**
 * Convert page-level OCR progress into a fractional file-level progress ratio.
 *
 * @param {{
 *   progress: number,
 *   pageNumber: number,
 *   totalPages: number,
 * }} ocrProgress - OCR status payload from the PDF extraction layer.
 * @returns {number} Fractional progress contribution for the current file.
 */
function createPageProgressRatio(ocrProgress) {
  const completedPages = Math.max(ocrProgress.pageNumber - 1, 0)
  const currentPageProgress = ocrProgress.progress ?? 0

  return (completedPages + currentPageProgress) / Math.max(ocrProgress.totalPages, 1)
}

/**
 * Call the optional progress reporter only when one has been provided.
 *
 * @param {Function | undefined} reportProgress - Optional UI progress callback.
 * @param {{ stage: string, fileName: string, current: number, total: number, message: string }} progressUpdate - Update payload.
 * @returns {void}
 */
function reportStageProgress(reportProgress, progressUpdate) {
  reportProgress?.(progressUpdate)
}
