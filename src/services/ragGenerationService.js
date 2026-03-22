/**
 * Build the fixed behavioral system prompt for the local document analyzer.
 *
 * @returns {string} Fixed behavioral rules for the local RAG answer.
 */
export function buildSystemPrompt() {
  return [
    'You are a strict Document Analysis AI.',
    'Answer using only the provided text.',
    'The provided text may contain OCR mistakes, broken formatting, or misspellings.',
    'When the intended meaning is clear, interpret obvious OCR errors instead of refusing immediately.',
    'Provide the most relevant grounded answer you can from the text and cite sources like [Source 1] when useful.',
    "If the text still does not contain the answer, reply with: I'm sorry, but I cannot find the answer to that in the provided documents.",
    'Do not invent facts.',
  ].join(' ')
}

/**
 * Format retrieved chunks into a prompt-ready context section with citation markers.
 *
 * @param {Array<{
 *   citationLabel: string,
 *   text: string,
 *   similarity: number,
 * }>} retrievedChunks - Ranked retrieval results used as context.
 * @returns {string} Prompt-ready context block.
 */
export function formatRetrievedContext(retrievedChunks) {
  if (!retrievedChunks.length) {
    return ''
  }

  return retrievedChunks
    .map((retrievedChunk, chunkPosition) =>
      formatSingleContextBlock(retrievedChunk, chunkPosition + 1),
    )
    .join('\n\n')
}

/**
 * Build the final user prompt that combines OCR-aware context with the active question.
 *
 * @param {Array<{
 *   citationLabel: string,
 *   text: string,
 *   similarity: number,
 * }>} retrievedChunks - Ranked retrieval results used as context.
 * @param {string} userQuery - The active user question.
 * @returns {string} Final user message content for WebLLM.
 */
export function buildContextualUserMessage(retrievedChunks, userQuery) {
  const formattedContext = formatRetrievedContext(retrievedChunks)
  const safeContext = formattedContext || 'No relevant context was retrieved from the selected documents.'

  return [
    'The following context comes from local documents and may include OCR noise.',
    'Use it as the sole basis for the answer.',
    '',
    `Context:\n${safeContext}`,
    '',
    `Question: ${userQuery}`,
  ].join('\n')
}

/**
 * Format one retrieved chunk into a readable cited context block.
 *
 * @param {{
 *   citationLabel: string,
 *   text: string,
 *   similarity: number,
 * }} retrievedChunk - One retrieved chunk.
 * @param {number} sourceNumber - One-based source number shown to the model.
 * @returns {string} One formatted context block.
 */
function formatSingleContextBlock(retrievedChunk, sourceNumber) {
  return [
    `[Source ${sourceNumber}] File: ${retrievedChunk.citationLabel}`,
    retrievedChunk.text,
  ].join('\n')
}
