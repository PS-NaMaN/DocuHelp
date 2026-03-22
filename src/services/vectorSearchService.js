import { getAllChunks, getAllDocuments } from './db'
import { logAndRethrow } from '../utils/logger'

/**
 * Compute cosine similarity between two dense Float32 vectors.
 *
 * @param {Float32Array} vectorA - First embedding vector.
 * @param {Float32Array} vectorB - Second embedding vector.
 * @returns {number} Cosine similarity score between -1 and 1.
 */
export function computeCosineSimilarity(vectorA, vectorB) {
  validateComparableVectors(vectorA, vectorB)

  let dotProduct = 0
  let vectorAMagnitudeSquared = 0
  let vectorBMagnitudeSquared = 0

  for (let valueIndex = 0; valueIndex < vectorA.length; valueIndex += 1) {
    const valueFromVectorA = vectorA[valueIndex]
    const valueFromVectorB = vectorB[valueIndex]

    dotProduct += valueFromVectorA * valueFromVectorB
    vectorAMagnitudeSquared += valueFromVectorA * valueFromVectorA
    vectorBMagnitudeSquared += valueFromVectorB * valueFromVectorB
  }

  const vectorAMagnitude = Math.sqrt(vectorAMagnitudeSquared)
  const vectorBMagnitude = Math.sqrt(vectorBMagnitudeSquared)

  if (!vectorAMagnitude || !vectorBMagnitude) {
    return 0
  }

  return dotProduct / (vectorAMagnitude * vectorBMagnitude)
}

/**
 * Search IndexedDB for the chunks most similar to the provided query vector.
 *
 * @param {Float32Array} queryVector - Embedded user query vector.
 * @param {number} [topK=3] - Maximum number of chunks to return.
 * @returns {Promise<Array<{
 *   id: number,
 *   documentId: number,
 *   documentName: string,
 *   chunkIndex: number,
 *   text: string,
 *   tokenCount: number,
 *   similarity: number,
 *   citationLabel: string,
 * }>>} Ranked chunk search results.
 */
export async function searchSimilarChunks(queryVector, topK = 3, activeFileNames = []) {
  try {
    if (!queryVector.length || topK <= 0) {
      return []
    }

    const [storedChunks, storedDocuments] = await Promise.all([getAllChunks(), getAllDocuments()])
    const documentNameById = createDocumentNameLookup(storedDocuments)
    const activeFileNameSet = createActiveFileNameSet(activeFileNames)
    const rankedChunks = storedChunks
      .filter((storedChunk) => isComparableChunk(storedChunk, queryVector))
      .filter((storedChunk) => isChunkActive(storedChunk, documentNameById, activeFileNameSet))
      .map((storedChunk) => createRankedChunkResult(storedChunk, queryVector, documentNameById))
      .sort(sortBySimilarityDescending)

    return rankedChunks.slice(0, Math.min(topK, 3))
  } catch (error) {
    logAndRethrow('searchSimilarChunks', error, {
      topK,
      queryVectorLength: queryVector.length,
      activeFileCount: activeFileNames.length,
    })
  }
}

/**
 * Convert active file names into a fast lookup set.
 *
 * @param {string[]} activeFileNames - File names currently enabled for retrieval.
 * @returns {Set<string>} Lookup set for file-scoped retrieval.
 */
function createActiveFileNameSet(activeFileNames) {
  return new Set(activeFileNames.filter(Boolean))
}

/**
 * Ensure both vectors can be compared safely.
 *
 * @param {Float32Array} vectorA - First embedding vector.
 * @param {Float32Array} vectorB - Second embedding vector.
 * @returns {void}
 * @throws {Error} Throws when the vectors are empty or dimension-mismatched.
 */
function validateComparableVectors(vectorA, vectorB) {
  if (!vectorA.length || !vectorB.length) {
    throw new Error('Cosine similarity requires non-empty Float32Array vectors.')
  }

  if (vectorA.length === vectorB.length) {
    return
  }

  throw new Error('Cosine similarity requires vectors with identical dimensions.')
}

/**
 * Build a lookup of document ids to readable document names for citations.
 *
 * @param {Array<{ id: number, name: string }>} storedDocuments - Stored document metadata records.
 * @returns {Map<number, string>} Document id to document name lookup.
 */
function createDocumentNameLookup(storedDocuments) {
  return new Map(
    storedDocuments.map((storedDocument) => [storedDocument.id, storedDocument.name]),
  )
}

/**
 * Check whether a stored chunk has an embedding compatible with the query vector.
 *
 * @param {{ embedding?: Float32Array }} storedChunk - Indexed chunk record.
 * @param {Float32Array} queryVector - Embedded user query vector.
 * @returns {boolean} True when the chunk can participate in similarity search.
 */
function isComparableChunk(storedChunk, queryVector) {
  return (
    storedChunk.embedding instanceof Float32Array &&
    storedChunk.embedding.length === queryVector.length
  )
}

/**
 * Check whether a chunk belongs to the currently active file filter set.
 *
 * @param {{ fileName?: string, documentId: number }} storedChunk - Stored chunk record.
 * @param {Map<number, string>} documentNameById - Document name lookup map.
 * @param {Set<string>} activeFileNameSet - Selected active file names.
 * @returns {boolean} True when the chunk should remain eligible for retrieval.
 */
function isChunkActive(storedChunk, documentNameById, activeFileNameSet) {
  if (!activeFileNameSet.size) {
    return true
  }

  const chunkFileName = storedChunk.fileName ?? documentNameById.get(storedChunk.documentId) ?? ''

  return activeFileNameSet.has(chunkFileName)
}

/**
 * Convert a raw chunk record into a ranked search result with similarity metadata.
 *
 * @param {{
 *   id: number,
 *   documentId: number,
 *   chunkIndex: number,
 *   text: string,
 *   tokenCount: number,
 *   embedding: Float32Array,
 * }} storedChunk - Raw chunk record from IndexedDB.
 * @param {Float32Array} queryVector - Embedded user query vector.
 * @param {Map<number, string>} documentNameById - Document name lookup map.
 * @returns {{
 *   id: number,
 *   documentId: number,
 *   documentName: string,
 *   chunkIndex: number,
 *   text: string,
 *   tokenCount: number,
 *   similarity: number,
 *   citationLabel: string,
 * }} Ranked search result.
 */
function createRankedChunkResult(storedChunk, queryVector, documentNameById) {
  const documentName =
    storedChunk.fileName ?? documentNameById.get(storedChunk.documentId) ?? 'Unknown document'
  const similarity = computeCosineSimilarity(queryVector, storedChunk.embedding)

  return {
    id: storedChunk.id,
    documentId: storedChunk.documentId,
    documentName,
    chunkIndex: storedChunk.chunkIndex,
    text: storedChunk.text,
    tokenCount: storedChunk.tokenCount,
    similarity,
    citationLabel: createCitationLabel(documentName, storedChunk.chunkIndex),
  }
}

/**
 * Create a readable citation label for one retrieved chunk.
 *
 * @param {string} documentName - Name of the source document.
 * @param {number} chunkIndex - Zero-based chunk index.
 * @returns {string} Human-readable citation label.
 */
function createCitationLabel(documentName, chunkIndex) {
  return `${documentName} / chunk ${chunkIndex + 1}`
}

/**
 * Sort search results from most relevant to least relevant.
 *
 * @param {{ similarity: number }} leftChunk - Left search result.
 * @param {{ similarity: number }} rightChunk - Right search result.
 * @returns {number} Sort comparator value.
 */
function sortBySimilarityDescending(leftChunk, rightChunk) {
  return rightChunk.similarity - leftChunk.similarity
}
