import { useRef, useState } from 'react'
import { generateEmbedding } from '../services/embeddingService'
import {
  buildContextualUserMessage,
  buildSystemPrompt,
} from '../services/ragGenerationService'
import { searchSimilarChunks } from '../services/vectorSearchService'
import { logFunctionError } from '../utils/logger'

const FALLBACK_REPLY =
  "I'm sorry, but I cannot find the answer to that in the provided documents."

/**
 * Coordinate the full local RAG query pipeline from query embedding to streamed answer.
 *
 * @param {{
 *   engine: import('@mlc-ai/web-llm').MLCEngine | null,
 *   topK?: number,
 *   generationSettings?: {
 *     temperature: number,
 *     topP: number,
 *     maxTokens: number,
 *     presencePenalty: number,
 *     frequencyPenalty: number,
 *     repetitionPenalty: number,
 *   },
 * }} options - Hook configuration including the active local WebLLM engine.
 * @returns {{
 *   messages: Array<{
 *     id: string,
 *     role: 'user' | 'assistant',
 *     content: string,
 *     citations?: Array<{ citationLabel: string, similarity: number }>,
 *   }>,
 *   isGenerating: boolean,
 *   currentStreamingReply: string,
 *   activeFileNames: string[],
 *   setActiveFileNames: React.Dispatch<React.SetStateAction<string[]>>,
 *   toggleFileSelection: (fileName: string) => void,
 *   askQuestion: (userQuery: string) => Promise<void>,
 * }} Query state and orchestrator function.
 */
export function useRagQuery(options) {
  const { engine, topK = 5, generationSettings } = options
  const nextMessageIdRef = useRef(0)
  const [messages, setMessages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [currentStreamingReply, setCurrentStreamingReply] = useState('')
  const [activeFileNames, setActiveFileNames] = useState([])

  /**
   * Run the full local RAG pipeline for one user question and stream the answer.
   *
   * @param {string} userQuery - Raw user question.
   * @returns {Promise<void>} Resolves when generation finishes or fails.
   */
  async function askQuestion(userQuery) {
    const normalizedUserQuery = userQuery.trim()

    if (!normalizedUserQuery || !engine || isGenerating) {
      return
    }

    const userMessage = createChatMessage('user', normalizedUserQuery)

    setMessages((previousMessages) => [...previousMessages, userMessage])
    setIsGenerating(true)
    setCurrentStreamingReply('')

    try {
      const queryVector = await generateEmbedding(normalizedUserQuery)
      const retrievedChunks = await searchSimilarChunks(
        queryVector,
        topK,
        activeFileNames,
        normalizedUserQuery,
      )
      const systemPrompt = buildSystemPrompt()
      const contextualUserMessage = buildContextualUserMessage(
        retrievedChunks,
        normalizedUserQuery,
      )
      const streamedReply = await streamRagAnswer(
        engine,
        systemPrompt,
        contextualUserMessage,
        generationSettings,
        setCurrentStreamingReply,
      )
      const assistantReply = normalizeAssistantReply(streamedReply)
      const assistantMessage = createAssistantMessage(assistantReply, retrievedChunks)

      setMessages((previousMessages) => [...previousMessages, assistantMessage])
      setCurrentStreamingReply('')
    } catch (error) {
      logFunctionError('useRagQuery.askQuestion', error, {
        queryLength: normalizedUserQuery.length,
        topK,
        activeFileCount: activeFileNames.length,
      })
      setCurrentStreamingReply('Unable to generate a local answer for this question.')
    } finally {
      setIsGenerating(false)
    }
  }

  /**
   * Toggle one file name inside the active retrieval filter set using immutable updates.
   *
   * @param {string} fileName - File name to add or remove from the active selection.
   * @returns {void}
   */
  function toggleFileSelection(fileName) {
    if (!fileName) {
      return
    }

    setActiveFileNames((previousActiveFileNames) => {
      const updatedActiveFileNames = previousActiveFileNames.includes(fileName)
        ? previousActiveFileNames.filter((activeFileName) => activeFileName !== fileName)
        : [...previousActiveFileNames, fileName]

      console.log('Current Active Files:', updatedActiveFileNames)

      return updatedActiveFileNames
    })
  }

  return {
    messages,
    isGenerating,
    currentStreamingReply,
    activeFileNames,
    setActiveFileNames,
    toggleFileSelection,
    askQuestion,
  }

  /**
   * Create a message id and shape for one chat message.
   *
   * @param {'user' | 'assistant'} role - Message author role.
   * @param {string} content - Message content text.
   * @returns {{ id: string, role: 'user' | 'assistant', content: string }} Chat message object.
   */
  function createChatMessage(role, content) {
    nextMessageIdRef.current += 1

    return {
      id: `message-${nextMessageIdRef.current}`,
      role,
      content,
    }
  }

  /**
   * Create a final assistant message including only the citations that should be shown in the UI.
   *
   * @param {string} replyText - Final streamed reply text.
   * @param {Array<{ citationLabel: string, similarity: number }>} retrievedChunks - Retrieval results used for context.
   * @returns {{
   *   id: string,
   *   role: 'assistant',
   *   content: string,
   *   citations: Array<{ citationLabel: string, similarity: number }>,
   * }} Final assistant chat message.
   */
  function createAssistantMessage(replyText, retrievedChunks) {
    const assistantMessage = createChatMessage('assistant', replyText)
    const selectedCitations = selectAssistantCitations(replyText, retrievedChunks)

    return {
      ...assistantMessage,
      citations: selectedCitations.map((retrievedChunk) => ({
        citationLabel: retrievedChunk.citationLabel,
        similarity: retrievedChunk.similarity,
      })),
    }
  }
}

/**
 * Stream a grounded answer from the active WebLLM engine while updating UI state.
 *
 * @param {import('@mlc-ai/web-llm').MLCEngine} engine - Active local WebLLM engine.
 * @param {string} systemPrompt - Retrieval-grounded system prompt.
 * @param {string} contextualUserMessage - Final user message containing both context and the question.
 * @param {{
 *   temperature?: number,
 *   topP?: number,
 *   maxTokens?: number,
 *   presencePenalty?: number,
 *   frequencyPenalty?: number,
 *   repetitionPenalty?: number,
 * } | undefined} generationSettings - User-configured generation controls.
 * @param {(replyText: string) => void} updateStreamingReply - Setter for the in-progress streamed reply.
 * @returns {Promise<string>} Final accumulated assistant reply.
 */
async function streamRagAnswer(
  engine,
  systemPrompt,
  contextualUserMessage,
  generationSettings,
  updateStreamingReply,
) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextualUserMessage },
  ]

  console.log('🚀 FINAL PAYLOAD TO LLM:', messages)

  const responseStream = await engine.chat.completions.create({
    stream: true,
    temperature: generationSettings?.temperature,
    top_p: generationSettings?.topP,
    max_tokens: generationSettings?.maxTokens,
    presence_penalty: generationSettings?.presencePenalty,
    frequency_penalty: generationSettings?.frequencyPenalty,
    repetition_penalty: generationSettings?.repetitionPenalty,
    messages,
  })

  let accumulatedReply = ''

  for await (const responseChunk of responseStream) {
    const deltaText = responseChunk.choices[0]?.delta?.content ?? ''

    if (!deltaText) {
      continue
    }

    accumulatedReply += deltaText
    updateStreamingReply(accumulatedReply)
  }

  return accumulatedReply.trim()
}

/**
 * Remove contradictory fallback text when the model already produced a substantive answer.
 *
 * @param {string} rawAssistantReply - Raw reply returned by the local model.
 * @returns {string} Cleaned assistant reply for the UI.
 */
function normalizeAssistantReply(rawAssistantReply) {
  const trimmedAssistantReply = rawAssistantReply.trim()

  if (!trimmedAssistantReply || trimmedAssistantReply === FALLBACK_REPLY) {
    return trimmedAssistantReply
  }

  const cleanedAssistantReply = stripTrailingFallbackInstruction(trimmedAssistantReply)

  return cleanedAssistantReply || FALLBACK_REPLY
}

/**
 * Keep only the citations that the assistant actually referenced, or fall back to the strongest ones.
 *
 * @param {string} replyText - Final assistant reply text.
 * @param {Array<{ citationLabel: string, similarity: number }>} retrievedChunks - Retrieved chunks used for prompting.
 * @returns {Array<{ citationLabel: string, similarity: number }>} Filtered citations for the UI.
 */
function selectAssistantCitations(replyText, retrievedChunks) {
  if (!retrievedChunks.length) {
    return []
  }

  const citedSourceNumbers = extractCitedSourceNumbers(replyText)

  if (citedSourceNumbers.length) {
    const explicitlyCitedChunks = citedSourceNumbers
      .map((sourceNumber) => retrievedChunks[sourceNumber - 1])
      .filter(Boolean)

    return deduplicateCitations(explicitlyCitedChunks)
  }

  const meaningfullyRelevantChunks = retrievedChunks.filter(
    (retrievedChunk) => retrievedChunk.similarity > 0.22,
  )
  const fallbackChunks = meaningfullyRelevantChunks.length
    ? meaningfullyRelevantChunks
    : retrievedChunks.slice(0, 1)

  return deduplicateCitations(fallbackChunks.slice(0, 2))
}

/**
 * Extract one-based `[Source N]` references from the assistant reply.
 *
 * @param {string} replyText - Final assistant reply text.
 * @returns {number[]} Unique cited source numbers in appearance order.
 */
function extractCitedSourceNumbers(replyText) {
  const sourceMatches = Array.from(replyText.matchAll(/\[Source\s+(\d+)\]/gi))
  const uniqueSourceNumbers = sourceMatches
    .map((sourceMatch) => Number.parseInt(sourceMatch[1], 10))
    .filter((sourceNumber) => Number.isInteger(sourceNumber) && sourceNumber > 0)

  return Array.from(new Set(uniqueSourceNumbers))
}

/**
 * Deduplicate citations by label while preserving their original order.
 *
 * @param {Array<{ citationLabel: string, similarity: number }>} citations - Candidate citations.
 * @returns {Array<{ citationLabel: string, similarity: number }>} Deduplicated citations.
 */
function deduplicateCitations(citations) {
  const seenCitationLabels = new Set()

  return citations.filter((citation) => {
    if (seenCitationLabels.has(citation.citationLabel)) {
      return false
    }

    seenCitationLabels.add(citation.citationLabel)
    return true
  })
}

/**
 * Remove contradictory refusal text when it appears after a substantive grounded answer.
 *
 * @param {string} assistantReply - Raw reply returned by the model.
 * @returns {string} Cleaned reply without a duplicated fallback instruction.
 */
function stripTrailingFallbackInstruction(assistantReply) {
  const replyWithoutInstructionTail = assistantReply
    .replace(/\s*Do not invent facts\.?$/i, '')
    .trim()
  const fallbackIndex = replyWithoutInstructionTail
    .toLowerCase()
    .indexOf(FALLBACK_REPLY.toLowerCase())

  if (fallbackIndex <= 0) {
    return replyWithoutInstructionTail
  }

  const answerBeforeFallback = replyWithoutInstructionTail.slice(0, fallbackIndex).trim()

  if (!looksLikeSubstantiveAnswer(answerBeforeFallback)) {
    return replyWithoutInstructionTail
  }

  return answerBeforeFallback
}

/**
 * Decide whether the model already produced enough grounded content to keep.
 *
 * @param {string} answerText - Portion of the reply that appears before the fallback sentence.
 * @returns {boolean} True when the answer is substantial enough to keep on its own.
 */
function looksLikeSubstantiveAnswer(answerText) {
  if (!answerText) {
    return false
  }

  const normalizedAnswerText = answerText
    .replace(/\[Source\s+\d+\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalizedAnswerText.split(' ').length >= 12
}
