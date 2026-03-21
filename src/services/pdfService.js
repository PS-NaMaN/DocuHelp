import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/**
 * Extract readable text from a PDF file by concatenating the text from each page.
 *
 * @param {File} pdfFile - Uploaded PDF file selected in the browser.
 * @returns {Promise<string>} Plain text extracted from the PDF.
 */
export async function extractPdfText(pdfFile) {
  const pdfBuffer = await pdfFile.arrayBuffer()
  const pdfDocument = await getDocument({ data: pdfBuffer }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const pageText = await extractPageText(pdfDocument, pageNumber)

    if (!pageText) {
      continue
    }

    pageTexts.push(pageText)
  }

  return pageTexts.join('\n\n')
}

/**
 * Extract normalized text from one PDF page.
 *
 * @param {import('pdfjs-dist/types/src/display/api').PDFDocumentProxy} pdfDocument - Parsed PDF document instance.
 * @param {number} pageNumber - One-based page number to extract.
 * @returns {Promise<string>} Normalized page text.
 */
async function extractPageText(pdfDocument, pageNumber) {
  const pdfPage = await pdfDocument.getPage(pageNumber)
  const pageTextContent = await pdfPage.getTextContent()
  const pageTextItems = pageTextContent.items
    .map((textItem) => ('str' in textItem ? textItem.str : ''))
    .join(' ')

  return normalizePdfWhitespace(pageTextItems)
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
