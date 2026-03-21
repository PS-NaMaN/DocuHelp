import { GlobalWorkerOptions, getDocument, OPS } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createOcrService } from './ocrService'
import { logAndRethrow } from '../utils/logger'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const MIN_DIGITAL_TEXT_CHARACTERS = 24
const OCR_RENDER_SCALE = 2
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
 * }} [options={}] - Optional OCR progress streaming callback.
 * @returns {Promise<string>} Plain text extracted from the PDF.
 */
export async function extractPdfText(pdfFile, options = {}) {
  let ocrService

  try {
    const pdfBuffer = await pdfFile.arrayBuffer()
    const pdfDocument = await getDocument({ data: pdfBuffer }).promise
    const pageTexts = []

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      const pageExtraction = await extractPageContent(pdfDocument, pageNumber)
      const pageText = await resolvePageText({
        pdfPage: pageExtraction.pdfPage,
        digitalPageText: pageExtraction.digitalPageText,
        pageContainsImages: pageExtraction.pageContainsImages,
        pageNumber,
        totalPages: pdfDocument.numPages,
        getOrCreateOcrService: async () => {
          if (!ocrService) {
            ocrService = await createPdfOcrService(pdfDocument.numPages, options.onOcrProgress)
          }

          return ocrService
        },
      })

      if (!pageText) {
        continue
      }

      pageTexts.push(pageText)
    }

    await ocrService?.terminate()

    return pageTexts.join('\n\n')
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
    } = options

    if (!shouldRunOcr(digitalPageText, pageContainsImages)) {
      return digitalPageText
    }

    const ocrService = await getOrCreateOcrService()
    renderedCanvas = await renderPageToCanvas(pdfPage)

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
 * @returns {Promise<{ recognizeCanvas: (canvas: HTMLCanvasElement | OffscreenCanvas) => Promise<string>, terminate: () => Promise<void> }>} OCR helpers.
 */
async function createPdfOcrService(totalPages, onOcrProgress) {
  try {
    let activePageNumber = 1

    const ocrService = await createOcrService({
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
    })
  }
}

/**
 * Render one PDF page to an off-screen canvas for OCR.
 *
 * @param {import('pdfjs-dist/types/src/display/api').PDFPageProxy} pdfPage - PDF.js page instance to render.
 * @returns {Promise<HTMLCanvasElement>} Rendered off-screen canvas.
 */
async function renderPageToCanvas(pdfPage) {
  try {
    const viewport = pdfPage.getViewport({ scale: OCR_RENDER_SCALE })
    const offscreenCanvas = createOffscreenCanvas(viewport.width, viewport.height)
    const renderingContext = offscreenCanvas.getContext('2d', { willReadFrequently: true })

    if (!renderingContext) {
      throw new Error('Unable to create a 2D canvas context for OCR rendering.')
    }

    await pdfPage.render({
      canvasContext: renderingContext,
      viewport,
    }).promise

    return offscreenCanvas
  } catch (error) {
    logAndRethrow('renderPageToCanvas', error)
  }
}

/**
 * Create an off-screen canvas in the browser.
 *
 * @param {number} width - Canvas width in pixels.
 * @param {number} height - Canvas height in pixels.
 * @returns {HTMLCanvasElement} Detached canvas element for page rendering.
 */
function createOffscreenCanvas(width, height) {
  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = Math.ceil(width)
  offscreenCanvas.height = Math.ceil(height)

  return offscreenCanvas
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
