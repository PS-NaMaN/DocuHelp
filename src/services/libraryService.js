import { clearIndexedData, getAllChunks, getAllDocuments } from './db'

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
 * Delete all locally indexed data created by this application.
 *
 * @returns {Promise<void>} Resolves when the local index has been cleared.
 */
export async function deleteAllIndexedData() {
  await clearIndexedData()
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
