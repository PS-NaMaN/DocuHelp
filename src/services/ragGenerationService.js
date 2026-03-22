/**
 * Build a strict system prompt that constrains the local LLM to retrieved context only.
 *
 * @param {Array<{
 *   citationLabel: string,
 *   text: string,
 *   similarity: number,
 * }>} retrievedChunks - Ranked retrieval results used as context.
 * @returns {string} Fully formatted system prompt for the local RAG answer.
 */
export function buildSystemPrompt(retrievedChunks) {
  const formattedContext = formatRetrievedContext(retrievedChunks)

  if (!formattedContext) {
    return [
      'You are a retrieval-grounded assistant.',
      'No supporting context was retrieved from the local document index.',
      'If the user asks a question, explain that the answer cannot be grounded in the indexed documents yet.',
      'Do not invent facts or citations.',
    ].join('\n')
  }

  return [
    'You are a privacy-first document analyst answering questions from local retrieved context.',
    'Answer only with facts supported by the provided context blocks.',
    'If the context is insufficient, say so clearly instead of guessing.',
    'When you use a context block, cite it inline using its marker such as [Source 1].',
    'Prefer concise, direct answers that synthesize the evidence across sources.',
    '',
    'Retrieved context:',
    formattedContext,
  ].join('\n')
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
function formatRetrievedContext(retrievedChunks) {
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
  const roundedSimilarity = retrievedChunk.similarity.toFixed(3)

  return [
    `[Source ${sourceNumber}] ${retrievedChunk.citationLabel}`,
    `Similarity: ${roundedSimilarity}`,
    retrievedChunk.text,
  ].join('\n')
}
