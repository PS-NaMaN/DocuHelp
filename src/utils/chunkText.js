const DEFAULT_TARGET_TOKENS = 400
const DEFAULT_OVERLAP_TOKENS = 50

/**
 * Split normalized document text into overlapping chunk windows for embeddings.
 *
 * @param {string} rawDocumentText - The extracted document text to chunk.
 * @param {{ targetTokens?: number, overlapTokens?: number }} [options={}] - Optional chunk sizing overrides.
 * @returns {Array<{ index: number, text: string, tokenCount: number }>} Readable chunk records in original order.
 */
export function chunkText(rawDocumentText, options = {}) {
  const chunkingOptions = resolveChunkingOptions(options)
  const normalizedDocumentText = cleanRawText(rawDocumentText)

  if (!normalizedDocumentText) {
    return []
  }

  const detectedSentences = detectSentenceBoundaries(normalizedDocumentText)
  const overlappingWindows = createOverlappingWindows(detectedSentences, chunkingOptions)

  return overlappingWindows.map((chunkRecord, chunkIndex) => ({
    ...chunkRecord,
    index: chunkIndex,
  }))
}

/**
 * Normalize whitespace so chunking decisions work on predictable text.
 *
 * @param {string} rawDocumentText - The unprocessed extracted text.
 * @returns {string} A whitespace-normalized version of the document text.
 */
function cleanRawText(rawDocumentText) {
  return rawDocumentText.replace(/\s+/g, ' ').trim()
}

/**
 * Resolve chunking defaults in one place so the main chunker stays focused on flow.
 *
 * @param {{ targetTokens?: number, overlapTokens?: number }} options - Partial chunk configuration.
 * @returns {{ targetTokens: number, overlapTokens: number }} Fully resolved chunk configuration.
 */
function resolveChunkingOptions(options) {
  return {
    targetTokens: options.targetTokens ?? DEFAULT_TARGET_TOKENS,
    overlapTokens: options.overlapTokens ?? DEFAULT_OVERLAP_TOKENS,
  }
}

/**
 * Break normalized text into sentence-like units before building chunk windows.
 *
 * @param {string} normalizedDocumentText - The cleaned document text.
 * @returns {string[]} Sentence candidates in reading order.
 */
function detectSentenceBoundaries(normalizedDocumentText) {
  if ('Segmenter' in Intl) {
    return segmentWithIntl(normalizedDocumentText)
  }

  return segmentWithRegex(normalizedDocumentText)
}

/**
 * Use the built-in sentence segmenter when available for more natural chunk edges.
 *
 * @param {string} normalizedDocumentText - The cleaned document text.
 * @returns {string[]} Sentence candidates in reading order.
 */
function segmentWithIntl(normalizedDocumentText) {
  const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' })

  return Array.from(
    sentenceSegmenter.segment(normalizedDocumentText),
    ({ segment }) => segment.trim(),
  ).filter(Boolean)
}

/**
 * Fallback sentence splitting for environments without Intl.Segmenter.
 *
 * @param {string} normalizedDocumentText - The cleaned document text.
 * @returns {string[]} Sentence candidates in reading order.
 */
function segmentWithRegex(normalizedDocumentText) {
  return (
    normalizedDocumentText.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()) ?? [
      normalizedDocumentText,
    ]
  )
}

/**
 * Convert sentences into chunk windows with token overlap preserved between neighbors.
 *
 * @param {string[]} detectedSentences - Sentences ready for chunk assembly.
 * @param {{ targetTokens: number, overlapTokens: number }} chunkingOptions - Window sizing rules.
 * @returns {Array<{ text: string, tokenCount: number }>} Chunk records without final indices.
 */
function createOverlappingWindows(detectedSentences, chunkingOptions) {
  const finalizedChunks = []
  let activeWindow = createEmptyWindow()

  for (const sentenceText of detectedSentences) {
    const sentenceTokenCount = estimateTokenCount(sentenceText)

    if (isOversizedSentence(sentenceTokenCount, chunkingOptions.targetTokens)) {
      const splitResult = flushWindowAroundOversizedSentence(
        activeWindow,
        sentenceText,
        finalizedChunks,
        chunkingOptions,
      )

      activeWindow = splitResult.nextWindow
      continue
    }

    if (shouldFlushWindow(activeWindow, sentenceTokenCount, chunkingOptions.targetTokens)) {
      finalizedChunks.push(createChunkRecord(activeWindow.sentences))
      activeWindow = createOverlapWindow(activeWindow.sentences, chunkingOptions.overlapTokens)
    }

    activeWindow = appendSentenceToWindow(activeWindow, sentenceText, sentenceTokenCount)
  }

  if (activeWindow.sentences.length) {
    finalizedChunks.push(createChunkRecord(activeWindow.sentences))
  }

  return finalizedChunks
}

/**
 * Create a predictable empty window shape for accumulation.
 *
 * @returns {{ sentences: string[], tokenCount: number }} An empty chunk assembly window.
 */
function createEmptyWindow() {
  return {
    sentences: [],
    tokenCount: 0,
  }
}

/**
 * Decide whether a sentence alone already exceeds the target chunk size.
 *
 * @param {number} sentenceTokenCount - Estimated token count for a sentence.
 * @param {number} targetTokens - Desired chunk size.
 * @returns {boolean} True when the sentence must be split before chunking.
 */
function isOversizedSentence(sentenceTokenCount, targetTokens) {
  return sentenceTokenCount > targetTokens
}

/**
 * Decide whether the current window should be finalized before adding another sentence.
 *
 * @param {{ sentences: string[], tokenCount: number }} activeWindow - Current chunk window.
 * @param {number} incomingSentenceTokenCount - Token count for the next sentence.
 * @param {number} targetTokens - Desired chunk size.
 * @returns {boolean} True when adding the sentence would overflow the active window.
 */
function shouldFlushWindow(activeWindow, incomingSentenceTokenCount, targetTokens) {
  if (!activeWindow.tokenCount) {
    return false
  }

  return activeWindow.tokenCount + incomingSentenceTokenCount > targetTokens
}

/**
 * Append one sentence to the active window while keeping token counts in sync.
 *
 * @param {{ sentences: string[], tokenCount: number }} activeWindow - Current chunk window.
 * @param {string} sentenceText - Sentence being appended.
 * @param {number} sentenceTokenCount - Estimated token count for the sentence.
 * @returns {{ sentences: string[], tokenCount: number }} Updated chunk window.
 */
function appendSentenceToWindow(activeWindow, sentenceText, sentenceTokenCount) {
  return {
    sentences: [...activeWindow.sentences, sentenceText],
    tokenCount: activeWindow.tokenCount + sentenceTokenCount,
  }
}

/**
 * Flush the current window, split an oversized sentence, and seed the next window.
 *
 * @param {{ sentences: string[], tokenCount: number }} activeWindow - The current in-progress chunk window.
 * @param {string} oversizedSentence - A sentence too large for a single target window.
 * @param {Array<{ text: string, tokenCount: number }>} finalizedChunks - The output chunk list being built.
 * @param {{ targetTokens: number, overlapTokens: number }} chunkingOptions - Window sizing rules.
 * @returns {{ nextWindow: { sentences: string[], tokenCount: number } }} The window state to continue with.
 */
function flushWindowAroundOversizedSentence(
  activeWindow,
  oversizedSentence,
  finalizedChunks,
  chunkingOptions,
) {
  if (activeWindow.sentences.length) {
    finalizedChunks.push(createChunkRecord(activeWindow.sentences))
    activeWindow = createOverlapWindow(activeWindow.sentences, chunkingOptions.overlapTokens)
  }

  const oversizedSentenceChunks = splitOversizedSentence(
    oversizedSentence,
    chunkingOptions.targetTokens,
    chunkingOptions.overlapTokens,
  )

  finalizedChunks.push(...oversizedSentenceChunks.slice(0, -1))

  const trailingChunk = oversizedSentenceChunks.at(-1)

  return {
    nextWindow: {
      sentences: [trailingChunk.text],
      tokenCount: trailingChunk.tokenCount,
    },
  }
}

/**
 * Split a single oversized sentence into fixed-size word windows with overlap.
 *
 * @param {string} oversizedSentence - The sentence that cannot fit into one chunk.
 * @param {number} targetTokens - Desired chunk size.
 * @param {number} overlapTokens - Desired overlap between neighboring windows.
 * @returns {Array<{ text: string, tokenCount: number }>} Window records derived from the sentence.
 */
function splitOversizedSentence(oversizedSentence, targetTokens, overlapTokens) {
  const sentenceWords = oversizedSentence.split(/\s+/).filter(Boolean)
  const splitChunks = []
  const stepSize = Math.max(1, targetTokens - overlapTokens)

  let wordStartIndex = 0

  while (wordStartIndex < sentenceWords.length) {
    const chunkWords = sentenceWords.slice(wordStartIndex, wordStartIndex + targetTokens)
    const chunkText = chunkWords.join(' ')

    splitChunks.push({
      text: chunkText,
      tokenCount: estimateTokenCount(chunkText),
    })

    if (wordStartIndex + targetTokens >= sentenceWords.length) {
      break
    }

    wordStartIndex += stepSize
  }

  return splitChunks
}

/**
 * Seed a new window with trailing sentences from the previous chunk to preserve overlap.
 *
 * @param {string[]} previousChunkSentences - Sentences that formed the last finalized chunk.
 * @param {number} overlapTokens - Desired token overlap.
 * @returns {{ sentences: string[], tokenCount: number }} A new active window seeded with overlap sentences.
 */
function createOverlapWindow(previousChunkSentences, overlapTokens) {
  const overlapSentences = []
  let overlapTokenCount = 0

  for (let sentenceIndex = previousChunkSentences.length - 1; sentenceIndex >= 0; sentenceIndex -= 1) {
    const trailingSentence = previousChunkSentences[sentenceIndex]
    const trailingSentenceTokenCount = estimateTokenCount(trailingSentence)

    if (wouldExceedOverlapBudget(overlapSentences, overlapTokenCount, trailingSentenceTokenCount, overlapTokens)) {
      break
    }

    overlapSentences.unshift(trailingSentence)
    overlapTokenCount += trailingSentenceTokenCount
  }

  return {
    sentences: overlapSentences,
    tokenCount: overlapTokenCount,
  }
}

/**
 * Check whether adding another overlap sentence would exceed the overlap budget.
 *
 * @param {string[]} overlapSentences - Sentences already selected for overlap.
 * @param {number} currentOverlapTokenCount - Tokens already reserved for overlap.
 * @param {number} nextSentenceTokenCount - Tokens in the next candidate sentence.
 * @param {number} overlapTokens - Maximum desired overlap.
 * @returns {boolean} True when the candidate sentence should be excluded.
 */
function wouldExceedOverlapBudget(
  overlapSentences,
  currentOverlapTokenCount,
  nextSentenceTokenCount,
  overlapTokens,
) {
  if (!overlapSentences.length) {
    return false
  }

  return currentOverlapTokenCount + nextSentenceTokenCount > overlapTokens
}

/**
 * Build the final text payload and token count for one chunk window.
 *
 * @param {string[]} chunkSentences - Sentences included in the chunk.
 * @returns {{ text: string, tokenCount: number }} A chunk record ready for storage.
 */
function createChunkRecord(chunkSentences) {
  const chunkText = chunkSentences.join(' ').trim()

  return {
    text: chunkText,
    tokenCount: estimateTokenCount(chunkText),
  }
}

/**
 * Use a whitespace-based approximation so chunking stays fast in the browser.
 *
 * @param {string} textSegment - Text to estimate.
 * @returns {number} Approximate token count for the text.
 */
function estimateTokenCount(textSegment) {
  return textSegment.split(/\s+/).filter(Boolean).length
}
