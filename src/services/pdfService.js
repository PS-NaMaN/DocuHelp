import { GlobalWorkerOptions, getDocument, OPS } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createOcrService, renderPdfPageForOcr } from './ocrService'
import { logAndRethrow } from '../utils/logger'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MIN_DIGITAL_TEXT_CHARACTERS = 24
const MIN_EXTRACTED_WORDS_PER_PAGE = 10
const ENABLE_EXTRACTION_AUDIT = true
const IMAGE_OPERATOR_NAMES = [
  'paintImageMaskXObject',
  'paintImageMaskXObjectRepeat',
  'paintImageXObject',
  'paintImageXObjectRepeat',
  'paintInlineImageXObject',
  'paintInlineImageXObjectGroup',
  'paintSolidColorImageMask',
  'paintJpegXObject',
]
const IMAGE_OPERATOR_IDS = new Set(
  IMAGE_OPERATOR_NAMES.map((operatorName) => OPS[operatorName]).filter((operatorId) => operatorId !== undefined),
)

/**
 * Extract readable text from a PDF file, falling back to OCR for scanned or image-heavy pages.
 *
 * @param {File} pdfFile - Uploaded PDF file selected in the browser.
 * @param {{
 *   onOcrProgress?: (progress: {
 *     stage: 'ocr',
 *     status: string,
 *     progress: number,
 *     pageNumber: number,
 *     totalPages: number,
 *   }) => void,
 *   ocrScale?: number,
 * }} [options={}] - Optional OCR progress streaming callback.
 * @returns {Promise<string>} Plain text extracted from the PDF.
 */
export async function extractPdfText(pdfFile, options = {}) {
  let ocrService

  try {
    const pdfBuffer = await pdfFile.arrayBuffer()
    const pdfDocument = await getDocument({ data: pdfBuffer }).promise
    const extractedPageRecords = []
    const extractionAuditRows = []

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pageExtraction = await extractPageContent(pdfDocument, pageNumber)
      const resolvedPageText = await resolvePageText({
        pdfPage: pageExtraction.pdfPage,
        digitalPageText: pageExtraction.digitalPageText,
        pageContainsImages: pageExtraction.pageContainsImages,
        pageNumber,
        totalPages: pdfDocument.numPages,
        getOrCreateOcrService: async () => {
          if (!ocrService) {
            ocrService = await createPdfOcrService(
              pdfDocument.numPages,
              options.onOcrProgress,
              options.ocrScale,
            )
          }

          return ocrService
        },
        ocrScale: options.ocrScale,
      })
      const cleanedPageText = cleanExtractedPageText(resolvedPageText)

      auditExtractedPage(pageNumber, cleanedPageText, extractionAuditRows)

      if (!cleanedPageText) {
        continue
      }

      extractedPageRecords.push({
        pageNumber,
        text: cleanedPageText,
      })
    }

    flushExtractionAuditTable(extractionAuditRows)
    await ocrService?.terminate()

    return concatenateExtractedPages(extractedPageRecords)
  } catch (error) {
    logAndRethrow('extractPdfText', error, {
      fileName: pdfFile.name,
    })
  } finally {
    await ocrService?.terminate()
  }
}

/**
 * Extract digital text and image heuristics for one PDF page.
 *
 * @param {import('pdfjs-dist/types/src/display/api').PDFDocumentProxy} pdfDocument - Parsed PDF document instance.
 * @param {number} pageNumber - One-based page number to extract.
 * @returns {Promise<{
 *   pdfPage: import('pdfjs-dist/types/src/display/api').PDFPageProxy,
 *   digitalPageText: string,
 *   pageContainsImages: boolean,
 * }>} Page content and OCR heuristics.
 */
async function extractPageContent(pdfDocument, pageNumber) {
  try {
    const pdfPage = await pdfDocument.getPage(pageNumber)
    const [pageTextContent, operatorList] = await Promise.all([
      pdfPage.getTextContent(),
      pdfPage.getOperatorList(),
    ])
    const digitalPageText = extractDigitalPageText(pageTextContent)
    const pageContainsImages = detectImageOperators(operatorList)

    return {
      pdfPage,
      digitalPageText,
      pageContainsImages,
    }
  } catch (error) {
    logAndRethrow('extractPageContent', error, {
      pageNumber,
    })
  }
}

/**
 * Decide whether OCR is necessary for a page and return the best available text.
 *
 * @param {{
 *   pdfPage: import('pdfjs-dist/types/src/display/api').PDFPageProxy,
 *   digitalPageText: string,
 *   pageContainsImages: boolean,
 *   pageNumber: number,
 *   totalPages: number,
 *   getOrCreateOcrService: () => Promise<{ recognizeCanvas: (canvas: HTMLCanvasElement | OffscreenCanvas) => Promise<string> }>,
 *   ocrScale?: number,
 * }} options - Page extraction context and OCR dependencies.
 * @returns {Promise<string>} The resolved page text, using OCR when needed.
 */
async function resolvePageText(options) {
  let renderedCanvas

  try {
    const {
      pdfPage,
      digitalPageText,
      pageContainsImages,
      pageNumber,
      getOrCreateOcrService,
      ocrScale = 2,
    } = options

    if (!shouldRunOcr(digitalPageText, pageContainsImages)) {
      return digitalPageText
    }

    const ocrService = await getOrCreateOcrService()
    renderedCanvas = await renderPdfPageForOcr(pdfPage, ocrScale)
    applyOcrPreprocessing(renderedCanvas)
    const ocrPageText = await ocrService.recognizeCanvas(renderedCanvas, pageNumber)

    return mergeDigitalAndOcrText(digitalPageText, ocrPageText)
  } catch (error) {
    logAndRethrow('resolvePageText', error, {
      pageNumber: options.pageNumber,
    })
  } finally {
    if (renderedCanvas) {
      releaseCanvas(renderedCanvas)
    }
  }
}

/**
 * Turn PDF.js text items into normalized digital text.
 *
 * @param {{ items: Array<Record<string, unknown>> }} pageTextContent - PDF.js page text payload.
 * @returns {string} Normalized digital text extracted from the page.
 */
function extractDigitalPageText(pageTextContent) {
  const joinedPageText = pageTextContent.items
    .map((textItem) => ('str' in textItem ? textItem.str : ''))
    .join(' ')

  return normalizePdfWhitespace(joinedPageText)
}

/**
 * Detect whether a page contains raster image drawing operators.
 *
 * @param {{ fnArray: number[] }} operatorList - PDF.js operator list for the page.
 * @returns {boolean} True when the page appears to draw one or more images.
 */
function detectImageOperators(operatorList) {
  return operatorList.fnArray.some((operatorId) => IMAGE_OPERATOR_IDS.has(operatorId))
}

/**
 * Decide whether the parser should OCR a page.
 *
 * @param {string} digitalPageText - Digital text extracted from the page.
 * @param {boolean} pageContainsImages - Whether PDF.js detected image draw operators on the page.
 * @returns {boolean} True when OCR should be run for the page.
 */
function shouldRunOcr(digitalPageText, pageContainsImages) {
  if (pageContainsImages) {
    return true
  }

  return digitalPageText.length < MIN_DIGITAL_TEXT_CHARACTERS
}

/**
 * Create the OCR service with page-aware progress reporting.
 *
 * @param {number} totalPages - Total page count in the document.
 * @param {((progress: {
 *   stage: 'ocr',
 *   status: string,
 *   progress: number,
 *   pageNumber: number,
 *   totalPages: number,
 * }) => void) | undefined} onOcrProgress - Optional caller progress callback.
 * @param {number | undefined} ocrScale - Requested OCR canvas render scale.
 * @returns {Promise<{ recognizeCanvas: (canvas: HTMLCanvasElement | OffscreenCanvas) => Promise<string>, terminate: () => Promise<void> }>} OCR helpers.
 */
async function createPdfOcrService(totalPages, onOcrProgress, ocrScale) {
  try {
    let activePageNumber = 1

    const ocrService = await createOcrService({
      ocrScale,
      onProgress: (progressUpdate) => {
        onOcrProgress?.({
          ...progressUpdate,
          pageNumber: activePageNumber,
          totalPages,
        })
      },
    })

    return {
      recognizeCanvas: async (canvas, pageNumber = activePageNumber) => {
        activePageNumber = pageNumber
        return ocrService.recognizeCanvas(canvas)
      },
      terminate: async () => ocrService.terminate(),
    }
  } catch (error) {
    logAndRethrow('createPdfOcrService', error, {
      totalPages,
      ocrScale,
    })
  }
}

/**
 * Convert a rendered page into a higher-contrast OCR input image.
 *
 * @param {HTMLCanvasElement} renderedCanvas - Off-screen canvas containing the rendered PDF page.
 * @returns {void}
 */
function applyOcrPreprocessing(renderedCanvas) {
  try {
    const renderingContext = renderedCanvas.getContext('2d', { willReadFrequently: true })

    if (!renderingContext) {
      throw new Error('Unable to access the OCR preprocessing canvas context.')
    }

    const pageImageData = renderingContext.getImageData(
      0,
      0,
      renderedCanvas.width,
      renderedCanvas.height,
    )

    applyHighContrastBinarization(pageImageData.data)
    renderingContext.putImageData(pageImageData, 0, 0)
  } catch (error) {
    logAndRethrow('applyOcrPreprocessing', error, {
      canvasWidth: renderedCanvas.width,
      canvasHeight: renderedCanvas.height,
    })
  }
}

/**
 * Convert RGBA image data to high-contrast grayscale for stronger OCR results.
 *
 * @param {Uint8ClampedArray} pixelData - Mutable RGBA pixel buffer from the rendered page.
 * @returns {void}
 */
function applyHighContrastBinarization(pixelData) {
  try {
    for (let pixelOffset = 0; pixelOffset < pixelData.length; pixelOffset += 4) {
      const redChannel = pixelData[pixelOffset]
      const greenChannel = pixelData[pixelOffset + 1]
      const blueChannel = pixelData[pixelOffset + 2]
      const grayscaleValue = Math.round(
        redChannel * 0.299 + greenChannel * 0.587 + blueChannel * 0.114,
      )
      const binarizedValue = grayscaleValue > 170 ? 255 : 0

      pixelData[pixelOffset] = binarizedValue
      pixelData[pixelOffset + 1] = binarizedValue
      pixelData[pixelOffset + 2] = binarizedValue
      pixelData[pixelOffset + 3] = 255
    }
  } catch (error) {
    logAndRethrow('applyHighContrastBinarization', error, {
      pixelCount: pixelData.length / 4,
    })
  }
}


/**
 * Combine digital extraction and OCR text while avoiding obvious duplication.
 *
 * @param {string} digitalPageText - Text extracted directly from the PDF page.
 * @param {string} ocrPageText - Text recognized from the rendered page image.
 * @returns {string} Best-effort merged page text.
 */
function mergeDigitalAndOcrText(digitalPageText, ocrPageText) {
  if (!digitalPageText) {
    return ocrPageText
  }

  if (!ocrPageText) {
    return digitalPageText
  }

  if (ocrPageText.includes(digitalPageText)) {
    return ocrPageText
  }

  if (digitalPageText.includes(ocrPageText)) {
    return digitalPageText
  }

  return `${digitalPageText}\n\n${ocrPageText}`.trim()
}

/**
 * Remove OCR noise that should not survive into chunking.
 *
 * @param {string} pageText - Resolved digital and/or OCR page text.
 * @returns {string} Clean page text ready for document concatenation.
 */
function cleanExtractedPageText(pageText) {
  return pageText
    .replace(/\u200B/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Record one page's extraction summary and warn on suspiciously small outputs.
 *
 * @param {number} pageNumber - One-based PDF page number.
 * @param {string} extractedPageText - Final cleaned text for the page.
 * @param {Array<{ 'Page Number': number, 'Word Count': number, Preview: string }>} extractedPageRecords - Mutable audit table rows.
 * @returns {void}
 */
function auditExtractedPage(pageNumber, extractedPageText, extractedPageRecords) {
  try {
    if (!ENABLE_EXTRACTION_AUDIT) {
      return
    }

    const extractedWordCount = countWords(extractedPageText)
    const previewText = extractedPageText.slice(0, 50)

    extractedPageRecords.push({
      'Page Number': pageNumber,
      'Word Count': extractedWordCount,
      Preview: previewText,
    })

    if (extractedWordCount < MIN_EXTRACTED_WORDS_PER_PAGE) {
      console.warn(`[DocuHelp] Page ${pageNumber} extraction suspect.`)
    }
  } catch (error) {
    logAndRethrow('auditExtractedPage', error, {
      pageNumber,
    })
  }
}

/**
 * Flush the per-page extraction audit table to the browser console.
 *
 * @param {Array<{ 'Page Number': number, 'Word Count': number, Preview: string }>} extractedPageRecords - Audit rows collected during extraction.
 * @returns {void}
 */
function flushExtractionAuditTable(extractedPageRecords) {
  try {
    if (!ENABLE_EXTRACTION_AUDIT || !extractedPageRecords.length) {
      return
    }

    console.table(extractedPageRecords)
  } catch (error) {
    logAndRethrow('flushExtractionAuditTable', error, {
      rowCount: extractedPageRecords.length,
    })
  }
}

/**
 * Count visible words in extracted text for audit heuristics.
 *
 * @param {string} extractedPageText - Final cleaned page text.
 * @returns {number} Approximate extracted word count.
 */
function countWords(extractedPageText) {
  if (!extractedPageText) {
    return 0
  }

  return extractedPageText.split(/\s+/).filter(Boolean).length
}

/**
 * Join cleaned page text into one document-level plain text string.
 *
 * @param {Array<{ pageNumber?: number, text?: string }>} extractedPageRecords - Cleaned page records.
 * @returns {string} Final concatenated PDF text ready for downstream cleaning.
 */
function concatenateExtractedPages(extractedPageRecords) {
  return extractedPageRecords
    .map((pageRecord) => pageRecord.text ?? '')
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Release canvas backing memory after OCR is finished.
 *
 * @param {HTMLCanvasElement} renderedCanvas - Off-screen canvas used for OCR.
 * @returns {void}
 */
function releaseCanvas(renderedCanvas) {
  renderedCanvas.width = 0
  renderedCanvas.height = 0
}

/**
 * Collapse excessive page whitespace before chunking.
 *
 * @param {string} pageText - Raw text extracted from a PDF page.
 * @returns {string} Whitespace-normalized page text.
 */
function normalizePdfWhitespace(pageText) {
  return pageText.replace(/\s+/g, ' ').trim()
}
