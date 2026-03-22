/**
 * Build a strict system prompt that constrains the local LLM to retrieved context only.
 *
 * @param {Array<{
 * citationLabel: string,
 * text: string,
 * similarity: number,
 * }>} retrievedChunks - Ranked retrieval results used as context.
 * @returns {string} Fully formatted system prompt for the local RAG answer.
 */
export function buildSystemPrompt(retrievedChunks) {
  const formattedContext = formatRetrievedContext(retrievedChunks)

  if (!formattedContext) {
    return [
      'You are a strict, retrieval-grounded assistant.',
      'CRITICAL: No supporting context was retrieved.',
      'You MUST reply exactly with: "I cannot answer this because no relevant documents were selected or found."',
      'Do not invent facts, and do not use outside knowledge.',
    ].join('\n')
  }

  return [
    'You are an expert Document Analysis AI. Your ONLY purpose is to answer the user\'s question based STRICTLY on the provided context below.',
    '',
    'CRITICAL RULES:',
    '1. You must NEVER use outside knowledge or internal training data. Assume you know nothing outside of the text provided.',
    '2. If the answer cannot be explicitly found in the provided context, you must reply EXACTLY with: "I\'m sorry, but I cannot find the answer to that in the provided documents." Do not attempt to guess or infer.',
    '3. Always cite your sources using the exact labels provided (e.g., [Source 1]).',
    '',
    '=== CONTEXT BEGIN ===',
    formattedContext,
    '=== CONTEXT END ===',
    '',
    'Now, answer the user\'s question using only the text between the CONTEXT markers.',
  ].join('\n')
}

/**
 * Format retrieved chunks into a prompt-ready context section with citation markers.
 *
 * @param {Array<{
 * citationLabel: string,
 * text: string,
 * similarity: number,
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
 * citationLabel: string,
 * text: string,
 * similarity: number,
 * }} retrievedChunk - One retrieved chunk.
 * @param {number} sourceNumber - One-based source number shown to the model.
 * @returns {string} One formatted context block.
 */
function formatSingleContextBlock(retrievedChunk, sourceNumber) {
  // Removed the similarity score so the LLM doesn't get distracted by the math.
  return [
    `[Source ${sourceNumber}] File: ${retrievedChunk.citationLabel}`,
    retrievedChunk.text,
  ].join('\n')
}