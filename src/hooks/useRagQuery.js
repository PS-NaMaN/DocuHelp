import { useRef, useState } from 'react'
import { generateEmbedding } from '../services/embeddingService'
import { buildSystemPrompt } from '../services/ragGenerationService'
import { searchSimilarChunks } from '../services/vectorSearchService'
import { logFunctionError } from '../utils/logger'

/**
 * Coordinate the full local RAG query pipeline from query embedding to streamed answer.
 *
 * @param {{
 *   engine: import('@mlc-ai/web-llm').MLCEngine | null,
 *   topK?: number,
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
  const { engine, topK = 5 } = options
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
      const retrievedChunks = await searchSimilarChunks(queryVector, topK, activeFileNames)
      const systemPrompt = buildSystemPrompt(retrievedChunks)
      const streamedReply = await streamRagAnswer(engine, systemPrompt, normalizedUserQuery, setCurrentStreamingReply)
      const assistantMessage = createAssistantMessage(streamedReply, retrievedChunks)

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
   * Create a final assistant message including retrieval citations used for generation.
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

    return {
      ...assistantMessage,
      citations: retrievedChunks.map((retrievedChunk) => ({
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
 * @param {string} userQuery - Original user question.
 * @param {(replyText: string) => void} updateStreamingReply - Setter for the in-progress streamed reply.
 * @returns {Promise<string>} Final accumulated assistant reply.
 */
async function streamRagAnswer(engine, systemPrompt, userQuery, updateStreamingReply) {
  const responseStream = await engine.chat.completions.create({
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ],
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
