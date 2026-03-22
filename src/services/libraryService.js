import {
  clearIndexedData,
  deleteDocumentChunks,
  getAllChunks,
  getAllDocuments,
  getUniqueFiles,
} from './indexedDBService'

/**
 * Return stored documents ordered from newest to oldest ingestion time.
 *
 * @returns {Promise<Array<Record<string, unknown>>>} Sorted document records for sidebar display.
 */
export async function getStoredDocuments() {
  const storedDocuments = await getAllDocuments()

  return sortDocumentsByNewestFirst(storedDocuments)
}

/**
 * Return the current top-level storage counts for the sidebar summary.
 *
 * @returns {Promise<{ documentCount: number, chunkCount: number }>} Document and chunk totals.
 */
export async function getStorageSummary() {
  const [storedDocuments, storedChunks] = await Promise.all([getAllDocuments(), getAllChunks()])

  return {
    documentCount: storedDocuments.length,
    chunkCount: storedChunks.length,
  }
}

/**
 * Return the unique uploaded file names currently available for retrieval selection.
 *
 * @returns {Promise<string[]>} Flat array of unique file names.
 */
export async function getUniqueStoredFiles() {
  return getUniqueFiles()
}

/**
 * Delete all locally indexed data created by this application.
 *
 * @returns {Promise<void>} Resolves when the local index has been cleared.
 */
export async function deleteAllIndexedData() {
  await clearIndexedData()
}

/**
 * Delete all locally indexed records tied to one uploaded file name.
 *
 * @param {string} fileName - File name whose chunks and document metadata should be removed.
 * @returns {Promise<void>} Resolves when the file has been removed from local storage.
 */
export async function deleteDocumentByFileName(fileName) {
  await deleteDocumentChunks(fileName)
}

/**
 * Sort document records so the newest ingestions appear first in the UI.
 *
 * @param {Array<Record<string, unknown>>} storedDocuments - Unsorted document records.
 * @returns {Array<Record<string, unknown>>} Sorted document records.
 */
function sortDocumentsByNewestFirst(storedDocuments) {
  return storedDocuments
    .slice()
    .sort((leftDocument, rightDocument) =>
      rightDocument.ingestedAt.localeCompare(leftDocument.ingestedAt),
    )
}
