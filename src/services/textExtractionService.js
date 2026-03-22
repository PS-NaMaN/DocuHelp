import { marked } from 'marked'
import { extractPdfText } from './pdfService'
import { logAndRethrow } from '../utils/logger'

const SUPPORTED_FILE_EXTENSIONS = new Set(['pdf', 'md', 'markdown', 'txt'])

/**
 * Extract plain text from a supported uploaded file so it can move through chunking.
 *
 * @param {File} uploadedFile - The browser file selected by the user.
 * @param {{
 *   onPdfOcrProgress?: (progress: {
 *     stage: 'ocr',
 *     status: string,
 *     progress: number,
 *     pageNumber: number,
 *     totalPages: number,
 *   }) => void,
 *   ocrScale?: number,
 * }} [options={}] - Optional PDF OCR progress callback.
 * @returns {Promise<string>} Normalized plain text extracted from the file.
 */
export async function extractTextFromFile(uploadedFile, options = {}) {
  try {
    const fileExtension = getFileExtension(uploadedFile.name)

    validateSupportedFile(uploadedFile.name, fileExtension)

    if (fileExtension === 'pdf') {
      const extractedPdfText = await extractPdfText(uploadedFile, {
        onOcrProgress: options.onPdfOcrProgress,
        ocrScale: options.ocrScale,
      })

      return sanitizeExtractedText(extractedPdfText)
    }

    const rawFileText = await uploadedFile.text()

    if (fileExtension === 'txt') {
      return sanitizeExtractedText(rawFileText)
    }

    return sanitizeExtractedText(extractMarkdownText(rawFileText))
  } catch (error) {
    logAndRethrow('extractTextFromFile', error, {
      fileName: uploadedFile.name,
    })
  }
}

/**
 * Pull the lowercase extension from a file name so routing stays explicit.
 *
 * @param {string} fileName - The original uploaded file name.
 * @returns {string} The lowercase extension without the dot, or an empty string.
 */
export function getFileExtension(fileName) {
  const fileNameParts = fileName.toLowerCase().split('.')

  return fileNameParts.length > 1 ? fileNameParts.at(-1) : ''
}

/**
 * Fail fast when the ingestion pipeline receives an unsupported file type.
 *
 * @param {string} fileName - The original uploaded file name.
 * @param {string} fileExtension - The parsed file extension.
 * @returns {void}
 */
function validateSupportedFile(fileName, fileExtension) {
  if (SUPPORTED_FILE_EXTENSIONS.has(fileExtension)) {
    return
  }

  throw new Error(`Unsupported file type: ${fileName}`)
}

/**
 * Convert markdown into readable plain text while preserving meaningful content.
 *
 * @param {string} rawMarkdown - Markdown source text from the uploaded file.
 * @returns {string} Normalized plain text extracted from the markdown structure.
 */
function extractMarkdownText(rawMarkdown) {
  const markdownTokens = marked.lexer(rawMarkdown)
  const textFragments = collectMarkdownTextFragments(markdownTokens)

  return normalizeWhitespace(textFragments.join('\n\n'))
}

/**
 * Walk markdown tokens recursively and collect all human-visible text fragments.
 *
 * @param {Array<Record<string, unknown>>} markdownTokens - Tokens returned by marked.
 * @returns {string[]} Visible text fragments in reading order.
 */
function collectMarkdownTextFragments(markdownTokens) {
  return markdownTokens.reduce((textFragments, token) => {
    appendTokenText(textFragments, token)
    appendNestedTokenText(textFragments, token)
    appendListItemText(textFragments, token)

    return textFragments
  }, [])
}

/**
 * Add a token's direct text payload when it exists.
 *
 * @param {string[]} textFragments - The mutable fragment collection.
 * @param {Record<string, unknown>} markdownToken - A marked token.
 * @returns {void}
 */
function appendTokenText(textFragments, markdownToken) {
  if (!('text' in markdownToken)) {
    return
  }

  const tokenText = markdownToken.text?.trim()

  if (!tokenText) {
    return
  }

  textFragments.push(tokenText)
}

/**
 * Recurse through nested markdown token arrays such as emphasis and paragraphs.
 *
 * @param {string[]} textFragments - The mutable fragment collection.
 * @param {Record<string, unknown>} markdownToken - A marked token.
 * @returns {void}
 */
function appendNestedTokenText(textFragments, markdownToken) {
  if (!('tokens' in markdownToken) || !Array.isArray(markdownToken.tokens)) {
    return
  }

  textFragments.push(...collectMarkdownTextFragments(markdownToken.tokens))
}

/**
 * Recurse through list item content so list text is not dropped during extraction.
 *
 * @param {string[]} textFragments - The mutable fragment collection.
 * @param {Record<string, unknown>} markdownToken - A marked token.
 * @returns {void}
 */
function appendListItemText(textFragments, markdownToken) {
  if (!('items' in markdownToken) || !Array.isArray(markdownToken.items)) {
    return
  }

  markdownToken.items.forEach((listItemToken) => {
    appendTokenText(textFragments, listItemToken)
    appendNestedTokenText(textFragments, listItemToken)
  })
}

/**
 * Normalize line endings and collapse excessive blank space before downstream processing.
 *
 * @param {string} rawText - Raw extracted text from a supported file.
 * @returns {string} Cleaned text ready for chunking.
 */
function normalizeWhitespace(rawText) {
  return rawText.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Remove OCR and parsing artifacts before text is handed to chunking.
 *
 * @param {string} extractedText - Full extracted document text.
 * @returns {string} Cleaned document text with empty fragments removed.
 */
function sanitizeExtractedText(extractedText) {
  return extractedText
    .replace(/\u200B/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((textLine) => textLine.trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}
