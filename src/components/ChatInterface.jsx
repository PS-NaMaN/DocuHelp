import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { logFunctionError } from '../utils/logger'

/**
 * Render the polished local chat interface for the RAG workspace.
 *
 * @param {{
 *   messages: Array<{
 *     id: string,
 *     role: 'user' | 'assistant',
 *     content: string,
 *     citations?: Array<{ citationLabel: string, similarity: number }>,
 *   }>,
 *   currentStreamingReply: string,
 *   isGenerating: boolean,
 *   isModelReady: boolean,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 *   onAskQuestion: (userQuery: string) => Promise<void>,
 * }} props - Chat messages, streaming state, and submit action.
 * @returns {JSX.Element} The chat workspace.
 */
function ChatInterface({
  messages,
  currentStreamingReply,
  isGenerating,
  isModelReady,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
  onAskQuestion,
}) {
  const [draftQuery, setDraftQuery] = useState('')
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentStreamingReply])

  /**
   * Submit the current draft to the local RAG pipeline.
   *
   * @param {React.FormEvent<HTMLFormElement>} event - Chat composer submit event.
   * @returns {Promise<void>} Resolves when the question has been handed to the pipeline.
   */
  async function handleSubmit(event) {
    event.preventDefault()

    const normalizedDraftQuery = draftQuery.trim()

    if (!normalizedDraftQuery || !isModelReady || isGenerating) {
      return
    }

    setDraftQuery('')

    try {
      await onAskQuestion(normalizedDraftQuery)
    } catch (error) {
      logFunctionError('ChatInterface.handleSubmit', error, {
        queryLength: normalizedDraftQuery.length,
      })
      setDraftQuery(normalizedDraftQuery)
    }
  }

  return (
    <section className="flex flex-col h-full bg-[linear-gradient(180deg,_rgba(255,255,255,0.06),_rgba(255,255,255,0.03))]">
      <div className="flex-shrink-0">
        <ChatHeader
          messageCount={messages.length}
          isGenerating={isGenerating}
          isModelReady={isModelReady}
          availableFileNames={availableFileNames}
          activeFileNames={activeFileNames}
          toggleFileSelection={toggleFileSelection}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {messages.length || currentStreamingReply ? (
          <div className="space-y-5">
            {messages.map((message) => (
              <ChatMessageBubble key={message.id} message={message} />
            ))}

            {currentStreamingReply ? (
              <StreamingMessageBubble currentStreamingReply={currentStreamingReply} />
            ) : null}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        ) : (
          <div className="h-full flex flex-col justify-center">
            <EmptyChatState isModelReady={isModelReady} />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/5">
        <ChatComposer
          draftQuery={draftQuery}
          isGenerating={isGenerating}
          isModelReady={isModelReady}
          onDraftQueryChange={setDraftQuery}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  )
}

/**
 * Render the chat header with the current model and activity state.
 *
 * @param {{
 *   messageCount: number,
 *   isGenerating: boolean,
 *   isModelReady: boolean,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 * }} props - Summary state for the chat session.
 * @returns {JSX.Element} The chat header.
 */
function ChatHeader({
  messageCount,
  isGenerating,
  isModelReady,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
}) {
  return (
    <div className="border-b border-white/10 px-5 py-5 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Local RAG Chat
          </p>
          <h3 className="mt-3 font-serif text-2xl leading-tight text-white">
            Ask grounded questions against your private document index.
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={isModelReady ? 'Model ready' : 'Model not ready'}
            tone={isModelReady ? 'ready' : 'idle'}
          />
          <StatusBadge
            label={isGenerating ? 'Generating' : `${messageCount} messages`}
            tone={isGenerating ? 'working' : 'neutral'}
          />
        </div>
      </div>

      <DocumentSelector
        availableFileNames={availableFileNames}
        activeFileNames={activeFileNames}
        toggleFileSelection={toggleFileSelection}
      />
    </div>
  )
}

/**
 * Render the document selection pills used to scope retrieval.
 *
 * @param {{
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 * }} props - Available files, active selection, and click handler.
 * @returns {JSX.Element | null} The selector row when files exist.
 */
function DocumentSelector({ availableFileNames, activeFileNames, toggleFileSelection }) {
  if (!availableFileNames.length) {
    return null
  }

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">
        Query Documents
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {availableFileNames.map((fileName) => (
          <DocumentSelectorPill
            key={fileName}
            fileName={fileName}
            isActive={activeFileNames.includes(fileName)}
            toggleFileSelection={toggleFileSelection}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Render one file pill that toggles inclusion in the retrieval scope.
 *
 * @param {{
 *   fileName: string,
 *   isActive: boolean,
 *   toggleFileSelection: (fileName: string) => void,
 * }} props - One file selector pill.
 * @returns {JSX.Element} One file pill.
 */
function DocumentSelectorPill({ fileName, isActive, toggleFileSelection }) {
  return (
    <button
      type="button"
      className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
        isActive
          ? 'border-cyan-300 bg-cyan-400/12 text-cyan-100'
          : 'border-white/12 bg-white/5 text-stone-300 hover:border-white/20 hover:bg-white/8'
      }`}
      onClick={() => toggleFileSelection(fileName)}
    >
      {fileName}
    </button>
  )
}

/**
 * Render one persisted chat message with role-specific styling.
 *
 * @param {{
 *   message: {
 *     role: 'user' | 'assistant',
 *     content: string,
 *     citations?: Array<{ citationLabel: string, similarity: number }>,
 *   },
 * }} props - One chat message record.
 * @returns {JSX.Element} A styled message bubble.
 */
function ChatMessageBubble({ message }) {
  const isUserMessage = message.role === 'user'

  return (
    <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
      <article
        className={`max-w-3xl rounded-[1.5rem] px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.12)] md:px-5 ${
          isUserMessage
            ? 'bg-[linear-gradient(135deg,_#22d3ee,_#0ea5e9)] text-stone-950'
            : 'border border-white/10 bg-white/7 text-stone-100'
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
          {isUserMessage ? 'You' : 'DocuHelp'}
        </p>

        <div className={`mt-3 prose prose-sm max-w-none prose-p:leading-7 md:prose-base md:prose-p:leading-8 ${isUserMessage ? 'prose-stone prose-p:text-stone-950' : 'prose-invert prose-p:text-stone-100'}`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.role === 'assistant' && message.citations?.length ? (
          <CitationChipList citations={message.citations} />
        ) : null}
      </article>
    </div>
  )
}

/**
 * Render the in-progress assistant reply with a blinking cursor indicator.
 *
 * @param {{ currentStreamingReply: string }} props - Current streamed text from the model.
 * @returns {JSX.Element} The streaming reply bubble.
 */
function StreamingMessageBubble({ currentStreamingReply }) {
  return (
    <div className="flex justify-start">
      <article className="max-w-3xl rounded-[1.5rem] border border-cyan-300/25 bg-cyan-400/8 px-4 py-4 text-stone-100 shadow-[0_18px_55px_rgba(8,145,178,0.12)] md:px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
          DocuHelp
        </p>
        <div className="mt-3 prose prose-sm prose-invert max-w-none prose-p:leading-7 md:prose-base md:prose-p:leading-8 prose-p:text-stone-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {currentStreamingReply}
          </ReactMarkdown>
          <span className="ml-1 inline-block h-5 w-2 rounded-sm bg-cyan-300 align-middle animate-pulse" />
        </div>
      </article>
    </div>
  )
}

/**
 * Render citation chips for the retrieved chunks used in an assistant answer.
 *
 * @param {{
 *   citations: Array<{ citationLabel: string, similarity: number }>,
 * }} props - Retrieval citations attached to one assistant message.
 * @returns {JSX.Element} The citation chip row.
 */
function CitationChipList({ citations }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <CitationChip key={citation.citationLabel} citation={citation} />
      ))}
    </div>
  )
}

/**
 * Render one citation chip showing the source file name with hover details.
 *
 * @param {{
 *   citation: { citationLabel: string, similarity: number },
 * }} props - One retrieval citation.
 * @returns {JSX.Element} One citation chip.
 */
function CitationChip({ citation }) {
  const sourceFileName = extractSourceFileName(citation.citationLabel)
  const similarityPercentage = Math.round(citation.similarity * 100)

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/15 px-3 py-2 text-xs font-medium text-stone-200 transition hover:border-cyan-300/35 hover:bg-cyan-400/10"
      title={`${citation.citationLabel} • similarity ${similarityPercentage}%`}
    >
      <span className="h-2 w-2 rounded-full bg-cyan-300" />
      <span>{sourceFileName}</span>
    </span>
  )
}

/**
 * Render the empty state before any chat has started.
 *
 * @param {{ isModelReady: boolean }} props - Current model readiness flag.
 * @returns {JSX.Element} Empty chat placeholder.
 */
function EmptyChatState({ isModelReady }) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center">
      <div className="max-w-xl rounded-[1.6rem] border border-dashed border-white/12 bg-black/10 px-6 py-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
          Ready when you are
        </p>
        <p className="mt-4 text-base leading-7 text-stone-200">
          {isModelReady
            ? 'Ask a question about your indexed documents to retrieve the most relevant chunks and stream a grounded answer.'
            : 'Initialize the local model first. Once WebGPU is ready, you can ask questions against your locally indexed documents.'}
        </p>
      </div>
    </div>
  )
}

/**
 * Render the chat composer and submit action.
 *
 * @param {{
 *   draftQuery: string,
 *   isGenerating: boolean,
 *   isModelReady: boolean,
 *   onDraftQueryChange: (value: string) => void,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 * }} props - Controlled composer state and handlers.
 * @returns {JSX.Element} The chat composer.
 */
function ChatComposer({
  draftQuery,
  isGenerating,
  isModelReady,
  onDraftQueryChange,
  onSubmit,
}) {
  const isSubmitDisabled = !draftQuery.trim() || !isModelReady || isGenerating

  return (
    <form className="w-full" onSubmit={onSubmit}>
      <div className="rounded-[1.7rem] border border-white/10 bg-black/15 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <label className="block">
          <span className="sr-only">Ask a question about your indexed documents</span>
          <textarea
            className="min-h-[112px] w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-white outline-none placeholder:text-stone-500"
            placeholder="Ask a question grounded in your uploaded documents..."
            value={draftQuery}
            onChange={(event) => onDraftQueryChange(event.target.value)}
            disabled={!isModelReady || isGenerating}
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-5 text-stone-400">
            Answers are generated locally in your browser and should cite the retrieved source chunks.
          </p>

          <button
            type="submit"
            className="rounded-full bg-[linear-gradient(135deg,_#22d3ee,_#fb923c)] px-5 py-3 text-sm font-semibold text-stone-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isSubmitDisabled}
          >
            {isGenerating ? 'Generating...' : 'Ask DocuHelp'}
          </button>
        </div>
      </div>
    </form>
  )
}

/**
 * Render a compact status badge in the chat header.
 *
 * @param {{
 *   label: string,
 *   tone: 'ready' | 'working' | 'idle' | 'neutral',
 * }} props - Badge label and appearance variant.
 * @returns {JSX.Element} One status badge.
 */
function StatusBadge({ label, tone }) {
  const toneClassName = getStatusBadgeToneClassName(tone)

  return (
    <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${toneClassName}`}>
      {label}
    </span>
  )
}

/**
 * Map a badge tone to its Tailwind class list.
 *
 * @param {'ready' | 'working' | 'idle' | 'neutral'} tone - Visual tone variant.
 * @returns {string} Tailwind class list for the badge.
 */
function getStatusBadgeToneClassName(tone) {
  if (tone === 'ready') {
    return 'bg-emerald-400/12 text-emerald-200'
  }

  if (tone === 'working') {
    return 'bg-cyan-400/12 text-cyan-200'
  }

  if (tone === 'idle') {
    return 'bg-amber-400/12 text-amber-200'
  }

  return 'bg-white/8 text-stone-300'
}

/**
 * Extract a readable source file name from the stored citation label.
 *
 * @param {string} citationLabel - Stored citation label from retrieval.
 * @returns {string} Source file name suitable for a chip.
 */
function extractSourceFileName(citationLabel) {
  if (!citationLabel.includes(' / chunk ')) {
    return citationLabel
  }

  return citationLabel.split(' / chunk ')[0]
}

export default ChatInterface
