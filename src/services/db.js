import { openDB } from 'idb'

const DATABASE_NAME = 'docuhelp'
const DATABASE_VERSION = 1
const DOCUMENT_STORE_NAME = 'documents'
const CHUNK_STORE_NAME = 'chunks'

const databasePromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
  /**
   * Initialize the IndexedDB schema used by DocuHelp.
   *
   * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
   * @returns {void}
   */
  upgrade(database) {
    createDocumentStore(database)
    createChunkStore(database)
  },
})

/**
 * Store one document-level metadata record.
 *
 * @param {Record<string, unknown>} documentRecord - Document metadata prepared for persistence.
 * @returns {Promise<number>} The generated document id.
 */
export async function saveDocument(documentRecord) {
  const database = await databasePromise

  return database.add(DOCUMENT_STORE_NAME, documentRecord)
}

/**
 * Replace all stored chunks for one document with a new set of chunk records.
 *
 * @param {number} documentId - Parent document id for the chunks.
 * @param {Array<Record<string, unknown>>} chunkRecords - Chunk rows that should replace the existing set.
 * @returns {Promise<void>} Resolves when the replacement transaction is committed.
 */
export async function replaceChunksForDocument(documentId, chunkRecords) {
  const database = await databasePromise
  const transaction = database.transaction(CHUNK_STORE_NAME, 'readwrite')

  await deleteExistingChunksForDocument(transaction, documentId)
  await insertChunkRecords(transaction, chunkRecords)
  await transaction.done
}

/**
 * Retrieve all stored document metadata records.
 *
 * @returns {Promise<Array<Record<string, unknown>>>} Every stored document record.
 */
export async function getAllDocuments() {
  const database = await databasePromise

  return database.getAllFromIndex(DOCUMENT_STORE_NAME, 'by-ingested-at')
}

/**
 * Retrieve all stored chunk records.
 *
 * @returns {Promise<Array<Record<string, unknown>>>} Every stored chunk record.
 */
export async function getAllChunks() {
  const database = await databasePromise

  return database.getAll(CHUNK_STORE_NAME)
}

/**
 * Clear all locally indexed document and chunk data for this site.
 *
 * @returns {Promise<void>} Resolves when both stores have been cleared.
 */
export async function clearIndexedData() {
  const database = await databasePromise
  const transaction = database.transaction([DOCUMENT_STORE_NAME, CHUNK_STORE_NAME], 'readwrite')

  await transaction.objectStore(CHUNK_STORE_NAME).clear()
  await transaction.objectStore(DOCUMENT_STORE_NAME).clear()
  await transaction.done
}

/**
 * Create the top-level document metadata store and its indexes.
 *
 * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
 * @returns {void}
 */
function createDocumentStore(database) {
  const documentStore = database.createObjectStore(DOCUMENT_STORE_NAME, {
    keyPath: 'id',
    autoIncrement: true,
  })

  documentStore.createIndex('by-ingested-at', 'ingestedAt')
}

/**
 * Create the chunk store and indexes used for document-level lookups.
 *
 * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
 * @returns {void}
 */
function createChunkStore(database) {
  const chunkStore = database.createObjectStore(CHUNK_STORE_NAME, {
    keyPath: 'id',
    autoIncrement: true,
  })

  chunkStore.createIndex('by-document-id', 'documentId')
  chunkStore.createIndex('by-document-and-index', ['documentId', 'chunkIndex'], {
    unique: true,
  })
}

/**
 * Remove any previously stored chunks for a document before inserting fresh ones.
 *
 * @param {import('idb').IDBPTransaction} transaction - The active chunk transaction.
 * @param {number} documentId - Parent document id for the chunks being replaced.
 * @returns {Promise<void>} Resolves after all existing chunks have been deleted.
 */
async function deleteExistingChunksForDocument(transaction, documentId) {
  const chunkIndex = transaction.store.index('by-document-id')

  for await (const existingChunkCursor of chunkIndex.iterate(IDBKeyRange.only(documentId))) {
    existingChunkCursor.delete()
  }
}

/**
 * Insert the next set of chunk records into the active transaction.
 *
 * @param {import('idb').IDBPTransaction} transaction - The active chunk transaction.
 * @param {Array<Record<string, unknown>>} chunkRecords - Chunk rows ready to persist.
 * @returns {Promise<void>} Resolves after all chunk records have been written.
 */
async function insertChunkRecords(transaction, chunkRecords) {
  for (const chunkRecord of chunkRecords) {
    await transaction.store.add(chunkRecord)
  }
}
