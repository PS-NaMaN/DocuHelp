import { getAllChunks, getAllDocuments } from './db'
import { logAndRethrow } from '../utils/logger'

const COMMON_QUERY_TERMS = new Set([
  'what',
  'which',
  'when',
  'where',
  'who',
  'whom',
  'whose',
  'why',
  'how',
  'is',
  'are',
  'was',
  'were',
  'the',
  'a',
  'an',
  'of',
  'for',
  'to',
  'in',
  'on',
  'and',
  'or',
  'about',
])

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
 * @param {string[]} [activeFileNames=[]] - Optional file-scope filter.
 * @param {string} [queryText=''] - Raw user query used for lexical reranking.
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
export async function searchSimilarChunks(queryVector, topK = 3, activeFileNames = [], queryText = '') {
  try {
    if (!queryVector.length || topK <= 0) {
      return []
    }

    const [storedChunks, storedDocuments] = await Promise.all([getAllChunks(), getAllDocuments()])
    const documentNameById = createDocumentNameLookup(storedDocuments)
    const activeFileNameSet = createActiveFileNameSet(activeFileNames)
    const querySignals = createQuerySignals(queryText)
    const rankedChunks = storedChunks
      .filter((storedChunk) => isComparableChunk(storedChunk, queryVector))
      .filter((storedChunk) => isChunkActive(storedChunk, documentNameById, activeFileNameSet))
      .map((storedChunk) =>
        createRankedChunkResult(storedChunk, queryVector, documentNameById, querySignals),
      )
      .sort(sortBySimilarityDescending)
    const filteredRankedChunks = filterRankedChunksForQueryIntent(rankedChunks, querySignals)

    logRetrievalSnapshot(queryText, filteredRankedChunks)

    return filteredRankedChunks.slice(0, Math.min(topK, 3))
  } catch (error) {
    logAndRethrow('searchSimilarChunks', error, {
      topK,
      queryVectorLength: queryVector.length,
      activeFileCount: activeFileNames.length,
      queryTextLength: queryText.length,
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
 * Extract salient lexical signals from the raw user query for reranking.
 *
 * @param {string} queryText - Raw user query text.
 * @returns {{ salientTerms: string[] }} Normalized lexical query helpers.
 */
function createQuerySignals(queryText) {
  const normalizedQueryText = queryText.toLowerCase().trim()
  const salientTerms = normalizedQueryText
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((queryTerm) => shouldKeepQueryTerm(queryTerm))
  const uniqueSalientTerms = Array.from(new Set(salientTerms))
  const distinctiveTerms = uniqueSalientTerms.filter((queryTerm) => queryTerm.length >= 5)

  return {
    normalizedQueryText,
    salientTerms: uniqueSalientTerms,
    distinctiveTerms,
  }
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
 *   fileName?: string,
 * }} storedChunk - Raw chunk record from IndexedDB.
 * @param {Float32Array} queryVector - Embedded user query vector.
 * @param {Map<number, string>} documentNameById - Document name lookup map.
 * @param {{ salientTerms: string[] }} querySignals - Lexical query helpers.
 * @returns {{
 *   id: number,
 *   documentId: number,
 *   documentName: string,
 *   chunkIndex: number,
 *   text: string,
 *   tokenCount: number,
 *   similarity: number,
 *   semanticSimilarity: number,
 *   lexicalSimilarity: number,
 *   matchedTerms: string[],
 *   citationLabel: string,
 * }} Ranked search result.
 */
function createRankedChunkResult(storedChunk, queryVector, documentNameById, querySignals) {
  const documentName =
    storedChunk.fileName ?? documentNameById.get(storedChunk.documentId) ?? 'Unknown document'
  const semanticSimilarity = computeCosineSimilarity(queryVector, storedChunk.embedding)
  const lexicalSimilarity = computeLexicalRerankScore(storedChunk, documentName, querySignals)
  const matchedTerms = findMatchedQueryTerms(storedChunk, documentName, querySignals)
  const similarity = semanticSimilarity + lexicalSimilarity

  return {
    id: storedChunk.id,
    documentId: storedChunk.documentId,
    documentName,
    chunkIndex: storedChunk.chunkIndex,
    text: storedChunk.text,
    tokenCount: storedChunk.tokenCount,
    similarity,
    semanticSimilarity,
    lexicalSimilarity,
    matchedTerms,
    citationLabel: createCitationLabel(documentName, storedChunk.chunkIndex),
  }
}

/**
 * Compute a small lexical rerank score so named entities favor matching chunks and filenames.
 *
 * @param {{ text: string }} storedChunk - Stored chunk record.
 * @param {string} documentName - Parent document name.
 * @param {{ normalizedQueryText: string, salientTerms: string[], distinctiveTerms: string[] }} querySignals - Lexical query helpers.
 * @returns {number} Additive rerank score applied on top of semantic similarity.
 */
function computeLexicalRerankScore(storedChunk, documentName, querySignals) {
  if (!querySignals.salientTerms.length) {
    return 0
  }

  const normalizedChunkText = storedChunk.text.toLowerCase()
  const normalizedDocumentName = documentName.toLowerCase()
  const matchedTerms = findMatchedTermsInNormalizedContent(
    normalizedChunkText,
    normalizedDocumentName,
    querySignals.salientTerms,
  )
  const matchedDistinctiveTerms = findMatchedTermsInNormalizedContent(
    normalizedChunkText,
    normalizedDocumentName,
    querySignals.distinctiveTerms,
  )
  const containsWholeQuery = containsWholeQueryPhrase(
    normalizedChunkText,
    normalizedDocumentName,
    querySignals.normalizedQueryText,
  )

  if (!matchedTerms.length) {
    return querySignals.distinctiveTerms.length ? -0.35 : -0.2
  }

  const documentNameMatchesDistinctiveTerm = matchedDistinctiveTerms.some((queryTerm) =>
    normalizedDocumentName.includes(queryTerm),
  )
  const chunkTextMatchesDistinctiveTerm = matchedDistinctiveTerms.some((queryTerm) =>
    normalizedChunkText.includes(queryTerm),
  )

  return (
    matchedTerms.length * 0.1 +
    matchedDistinctiveTerms.length * 0.28 +
    (documentNameMatchesDistinctiveTerm ? 0.45 : 0) +
    (chunkTextMatchesDistinctiveTerm ? 0.18 : 0) +
    (containsWholeQuery ? 0.3 : 0)
  )
}

/**
 * Find which query terms actually appear in the chunk text or the document name.
 *
 * @param {{ text: string }} storedChunk - Stored chunk record.
 * @param {string} documentName - Parent document name.
 * @param {{ salientTerms: string[] }} querySignals - Lexical query helpers.
 * @returns {string[]} Query terms found in the candidate source.
 */
function findMatchedQueryTerms(storedChunk, documentName, querySignals) {
  return findMatchedTermsInNormalizedContent(
    storedChunk.text.toLowerCase(),
    documentName.toLowerCase(),
    querySignals.salientTerms,
  )
}

/**
 * Find the subset of target terms that appear in either the chunk text or the document name.
 *
 * @param {string} normalizedChunkText - Lower-cased chunk text.
 * @param {string} normalizedDocumentName - Lower-cased document name.
 * @param {string[]} targetTerms - Candidate query terms.
 * @returns {string[]} Matched terms.
 */
function findMatchedTermsInNormalizedContent(
  normalizedChunkText,
  normalizedDocumentName,
  targetTerms,
) {
  return targetTerms.filter(
    (targetTerm) =>
      normalizedChunkText.includes(targetTerm) || normalizedDocumentName.includes(targetTerm),
  )
}

/**
 * Check whether the full normalized query phrase appears inside the chunk or document name.
 *
 * @param {string} normalizedChunkText - Lower-cased chunk text.
 * @param {string} normalizedDocumentName - Lower-cased document name.
 * @param {string} normalizedQueryText - Lower-cased user query.
 * @returns {boolean} True when the whole query appears as a phrase.
 */
function containsWholeQueryPhrase(
  normalizedChunkText,
  normalizedDocumentName,
  normalizedQueryText,
) {
  if (!normalizedQueryText || normalizedQueryText.length < 5) {
    return false
  }

  return (
    normalizedChunkText.includes(normalizedQueryText) ||
    normalizedDocumentName.includes(normalizedQueryText)
  )
}

/**
 * Decide whether a token from the user query is meaningful enough for lexical reranking.
 *
 * @param {string} queryTerm - One token from the normalized query text.
 * @returns {boolean} True when the token should influence reranking.
 */
function shouldKeepQueryTerm(queryTerm) {
  if (queryTerm.length >= 3 && !COMMON_QUERY_TERMS.has(queryTerm)) {
    return true
  }

  return queryTerm === 'ai'
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
 * Reduce noisy retrieval results when the query includes distinctive named terms.
 *
 * @param {Array<{
 *   similarity: number,
 *   semanticSimilarity: number,
 *   lexicalSimilarity: number,
 *   matchedTerms: string[],
 * }>} rankedChunks - Ranked retrieval candidates.
 * @param {{ distinctiveTerms: string[] }} querySignals - Lexical query helpers.
 * @returns {Array<{
 *   similarity: number,
 *   semanticSimilarity: number,
 *   lexicalSimilarity: number,
 *   matchedTerms: string[],
 * }>} Filtered candidates ready for the final top-K slice.
 */
function filterRankedChunksForQueryIntent(rankedChunks, querySignals) {
  if (!rankedChunks.length) {
    return rankedChunks
  }

  const distinctiveMatches = rankedChunks.filter((rankedChunk) =>
    querySignals.distinctiveTerms.some((queryTerm) => rankedChunk.matchedTerms.includes(queryTerm)),
  )

  if (distinctiveMatches.length) {
    return distinctiveMatches
  }

  const meaningfullyRankedChunks = rankedChunks.filter(
    (rankedChunk) => rankedChunk.similarity > 0.18 || rankedChunk.matchedTerms.length > 0,
  )

  return meaningfullyRankedChunks.length ? meaningfullyRankedChunks : rankedChunks
}

/**
 * Log a compact retrieval snapshot so ranking mistakes are visible in the browser console.
 *
 * @param {string} queryText - Raw user query.
 * @param {Array<{
 *   documentName: string,
 *   chunkIndex: number,
 *   similarity: number,
 *   semanticSimilarity: number,
 *   lexicalSimilarity: number,
 *   matchedTerms: string[],
 * }>} rankedChunks - Filtered retrieval candidates.
 * @returns {void}
 */
function logRetrievalSnapshot(queryText, rankedChunks) {
  if (!rankedChunks.length) {
    console.warn('[DocuHelp] Retrieval returned no eligible chunks.', {
      queryText,
    })
    return
  }

  console.table(
    rankedChunks.slice(0, 5).map((rankedChunk) => ({
      document: rankedChunk.documentName,
      chunk: rankedChunk.chunkIndex + 1,
      score: rankedChunk.similarity.toFixed(3),
      semantic: rankedChunk.semanticSimilarity.toFixed(3),
      lexical: rankedChunk.lexicalSimilarity.toFixed(3),
      matchedTerms: rankedChunk.matchedTerms.join(', '),
    })),
  )
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
