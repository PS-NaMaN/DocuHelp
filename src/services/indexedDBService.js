import { openDB } from 'idb'
import { logAndRethrow } from '../utils/logger'

const DATABASE_NAME = 'docuhelp'
const DATABASE_VERSION = 2
const DOCUMENT_STORE_NAME = 'documents'
const CHUNK_STORE_NAME = 'chunks'

const databasePromise = openDB(DATABASE_NAME, DATABASE_VERSION, {
  /**
   * Initialize or upgrade the IndexedDB schema used by DocuHelp.
   *
   * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
   * @param {number} previousVersion - Schema version before this upgrade.
   * @param {number | null} nextVersion - Schema version after this upgrade.
   * @param {import('idb').IDBPTransaction} transaction - Upgrade transaction shared across stores.
   * @returns {Promise<void>} Resolves when schema creation and data migration finish.
   */
  async upgrade(database, previousVersion, nextVersion, transaction) {
    createDocumentStore(database)
    createChunkStore(database)
    ensureDocumentIndexes(transaction)
    ensureChunkIndexes(transaction)

    if (previousVersion < 2) {
      await backfillChunkFileNames(transaction)
    }
  },
})

/**
 * Store one document-level metadata record.
 *
 * @param {Record<string, unknown>} documentRecord - Document metadata prepared for persistence.
 * @returns {Promise<number>} The generated document id.
 */
export async function saveDocument(documentRecord) {
  try {
    const database = await databasePromise

    return database.add(DOCUMENT_STORE_NAME, documentRecord)
  } catch (error) {
    logAndRethrow('saveDocument', error, {
      fileName: documentRecord?.name,
    })
  }
}

/**
 * Replace all stored chunks for one document with a new set of chunk records.
 *
 * @param {number} documentId - Parent document id for the chunks.
 * @param {Array<Record<string, unknown>>} chunkRecords - Chunk rows that should replace the existing set.
 * @returns {Promise<void>} Resolves when the replacement transaction is committed.
 */
export async function replaceChunksForDocument(documentId, chunkRecords) {
  try {
    const database = await databasePromise
    const transaction = database.transaction(CHUNK_STORE_NAME, 'readwrite')

    await deleteExistingChunksForDocument(transaction, documentId)
    await insertChunkRecords(transaction, chunkRecords)
    await transaction.done
  } catch (error) {
    logAndRethrow('replaceChunksForDocument', error, {
      documentId,
      chunkCount: chunkRecords.length,
    })
  }
}

/**
 * Retrieve all stored document metadata records.
 *
 * @returns {Promise<Array<Record<string, unknown>>>} Every stored document record.
 */
export async function getAllDocuments() {
  try {
    const database = await databasePromise

    return database.getAllFromIndex(DOCUMENT_STORE_NAME, 'by-ingested-at')
  } catch (error) {
    logAndRethrow('getAllDocuments', error)
  }
}

/**
 * Retrieve all stored chunk records.
 *
 * @returns {Promise<Array<Record<string, unknown>>>} Every stored chunk record.
 */
export async function getAllChunks() {
  try {
    const database = await databasePromise

    return database.getAll(CHUNK_STORE_NAME)
  } catch (error) {
    logAndRethrow('getAllChunks', error)
  }
}

/**
 * Return the unique uploaded file names stored by this site as a flat string array.
 *
 * @returns {Promise<string[]>} Unique file names such as `["file1.pdf", "file2.pdf"]`.
 */
export async function getUniqueFiles() {
  try {
    const storedDocuments = await getAllDocuments()
    const uniqueFileNames = storedDocuments
      .map((storedDocument) => storedDocument.name)
      .filter(Boolean)

    return Array.from(new Set(uniqueFileNames))
  } catch (error) {
    logAndRethrow('getUniqueFiles', error)
  }
}

/**
 * Delete all chunk and document records for one uploaded file name.
 *
 * @param {string} fileName - File name whose locally indexed data should be removed.
 * @returns {Promise<void>} Resolves after the matching chunks and document records are deleted.
 */
export async function deleteDocumentChunks(fileName) {
  try {
    if (!fileName) {
      return
    }

    const database = await databasePromise
    const transaction = database.transaction([DOCUMENT_STORE_NAME, CHUNK_STORE_NAME], 'readwrite')
    const chunkFileNameIndex = transaction.objectStore(CHUNK_STORE_NAME).index('by-file-name')
    const documentNameIndex = transaction.objectStore(DOCUMENT_STORE_NAME).index('by-name')

    for await (const matchingChunkCursor of chunkFileNameIndex.iterate(IDBKeyRange.only(fileName))) {
      matchingChunkCursor.delete()
    }

    for await (const matchingDocumentCursor of documentNameIndex.iterate(IDBKeyRange.only(fileName))) {
      matchingDocumentCursor.delete()
    }

    await transaction.done
  } catch (error) {
    logAndRethrow('deleteDocumentChunks', error, {
      fileName,
    })
  }
}

/**
 * Clear all locally indexed document and chunk data for this site.
 *
 * @returns {Promise<void>} Resolves when both stores have been cleared.
 */
export async function clearIndexedData() {
  try {
    const database = await databasePromise
    const transaction = database.transaction([DOCUMENT_STORE_NAME, CHUNK_STORE_NAME], 'readwrite')

    await transaction.objectStore(CHUNK_STORE_NAME).clear()
    await transaction.objectStore(DOCUMENT_STORE_NAME).clear()
    await transaction.done
  } catch (error) {
    logAndRethrow('clearIndexedData', error)
  }
}

/**
 * Create the top-level document metadata store when it does not already exist.
 *
 * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
 * @returns {void}
 */
function createDocumentStore(database) {
  if (database.objectStoreNames.contains(DOCUMENT_STORE_NAME)) {
    return
  }

  database.createObjectStore(DOCUMENT_STORE_NAME, {
    keyPath: 'id',
    autoIncrement: true,
  })
}

/**
 * Create the chunk store when it does not already exist.
 *
 * @param {import('idb').IDBPDatabase} database - Database instance being upgraded.
 * @returns {void}
 */
function createChunkStore(database) {
  if (database.objectStoreNames.contains(CHUNK_STORE_NAME)) {
    return
  }

  database.createObjectStore(CHUNK_STORE_NAME, {
    keyPath: 'id',
    autoIncrement: true,
  })
}

/**
 * Ensure document indexes exist for sort and deletion flows.
 *
 * @param {import('idb').IDBPTransaction} transaction - Upgrade transaction exposing the document store.
 * @returns {void}
 */
function ensureDocumentIndexes(transaction) {
  const documentStore = transaction.objectStore(DOCUMENT_STORE_NAME)

  if (!documentStore.indexNames.contains('by-ingested-at')) {
    documentStore.createIndex('by-ingested-at', 'ingestedAt')
  }

  if (!documentStore.indexNames.contains('by-name')) {
    documentStore.createIndex('by-name', 'name')
  }
}

/**
 * Ensure chunk indexes exist for document lookup and file-scoped deletion.
 *
 * @param {import('idb').IDBPTransaction} transaction - Upgrade transaction exposing the chunk store.
 * @returns {void}
 */
function ensureChunkIndexes(transaction) {
  const chunkStore = transaction.objectStore(CHUNK_STORE_NAME)

  if (!chunkStore.indexNames.contains('by-document-id')) {
    chunkStore.createIndex('by-document-id', 'documentId')
  }

  if (!chunkStore.indexNames.contains('by-document-and-index')) {
    chunkStore.createIndex('by-document-and-index', ['documentId', 'chunkIndex'], {
      unique: true,
    })
  }

  if (!chunkStore.indexNames.contains('by-file-name')) {
    chunkStore.createIndex('by-file-name', 'fileName')
  }
}

/**
 * Populate missing chunk `fileName` fields from their parent document records during upgrade.
 *
 * @param {import('idb').IDBPTransaction} transaction - Shared upgrade transaction.
 * @returns {Promise<void>} Resolves when all chunk records have been backfilled.
 */
async function backfillChunkFileNames(transaction) {
  const documentStore = transaction.objectStore(DOCUMENT_STORE_NAME)
  const chunkStore = transaction.objectStore(CHUNK_STORE_NAME)
  const documentNameById = new Map()

  for await (const documentCursor of documentStore) {
    documentNameById.set(documentCursor.value.id, documentCursor.value.name)
  }

  for await (const chunkCursor of chunkStore) {
    if (chunkCursor.value.fileName) {
      continue
    }

    const fileName = documentNameById.get(chunkCursor.value.documentId)

    if (!fileName) {
      continue
    }

    chunkCursor.update({
      ...chunkCursor.value,
      fileName,
    })
  }
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
 * @param {Array<Record<string, unknown>>} chunkRecords - Chunk rows ready for persistence.
 * @returns {Promise<void>} Resolves after all chunk records have been written.
 */
async function insertChunkRecords(transaction, chunkRecords) {
  for (const chunkRecord of chunkRecords) {
    await transaction.store.add(chunkRecord)
  }
}
