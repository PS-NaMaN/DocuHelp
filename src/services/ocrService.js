import { createWorker } from 'tesseract.js'
import { logAndRethrow } from '../utils/logger'

const DEFAULT_OCR_LANGUAGE = 'eng'
const DEFAULT_OCR_ENGINE_MODE = 1

/**
 * Create a document-scoped OCR service backed by a dedicated Tesseract worker.
 *
 * @param {{
 *   language?: string,
 *   onProgress?: (progress: {
 *     stage: 'ocr',
 *     status: string,
 *     progress: number,
 *   }) => void,
 * }} [options={}] - OCR worker configuration and progress callback.
 * @returns {Promise<{
 *   recognizeCanvas: (canvas: HTMLCanvasElement | OffscreenCanvas) => Promise<string>,
 *   terminate: () => Promise<void>,
 * }>} OCR helpers bound to a single worker instance.
 */
export async function createOcrService(options = {}) {
  try {
    const { language = DEFAULT_OCR_LANGUAGE, onProgress } = options
    const ocrWorker = await createWorker(language, DEFAULT_OCR_ENGINE_MODE, {
      logger: (message) => reportOcrProgress(onProgress, message),
    })

    return {
      recognizeCanvas: async (canvas) => recognizeCanvas(ocrWorker, canvas),
      terminate: async () => terminateWorker(ocrWorker),
    }
  } catch (error) {
    logAndRethrow('createOcrService', error, {
      language: options.language ?? DEFAULT_OCR_LANGUAGE,
    })
  }
}

/**
 * Recognize text from a rendered canvas and normalize the result for downstream chunking.
 *
 * @param {import('tesseract.js').Worker} ocrWorker - Active Tesseract worker instance.
 * @param {HTMLCanvasElement | OffscreenCanvas} renderedCanvas - Off-screen canvas containing the page image.
 * @returns {Promise<string>} Normalized OCR text.
 */
async function recognizeCanvas(ocrWorker, renderedCanvas) {
  try {
    const recognitionResult = await ocrWorker.recognize(renderedCanvas)

    return normalizeOcrText(recognitionResult.data.text)
  } catch (error) {
    logAndRethrow('recognizeCanvas', error)
  }
}

/**
 * Stream OCR worker status updates to the caller in a UI-friendly shape.
 *
 * @param {((progress: { stage: 'ocr', status: string, progress: number }) => void) | undefined} onProgress - Optional progress callback.
 * @param {{ status?: string, progress?: number }} workerMessage - Raw Tesseract logger payload.
 * @returns {void}
 */
function reportOcrProgress(onProgress, workerMessage) {
  if (!onProgress) {
    return
  }

  onProgress({
    stage: 'ocr',
    status: workerMessage.status ?? 'recognizing text',
    progress: workerMessage.progress ?? 0,
  })
}

/**
 * Normalize OCR output so it behaves like other extracted text in the pipeline.
 *
 * @param {string} rawOcrText - Raw text returned by Tesseract.
 * @returns {string} Cleaned OCR text.
 */
function normalizeOcrText(rawOcrText) {
  return rawOcrText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Shut down the worker and release OCR memory as soon as the document is done.
 *
 * @param {import('tesseract.js').Worker} ocrWorker - Active Tesseract worker instance.
 * @returns {Promise<void>} Resolves after the worker has terminated.
 */
async function terminateWorker(ocrWorker) {
  try {
    await ocrWorker.terminate()
  } catch (error) {
    logAndRethrow('terminateWorker', error)
  }
}
