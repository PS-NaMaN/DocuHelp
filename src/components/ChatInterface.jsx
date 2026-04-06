import { useEffect, useRef, useState } from 'react'
import { Menu, SendHorizontal } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { logFunctionError } from '../utils/logger'

const DEFAULT_TEXTAREA_HEIGHT = 48
const MAX_TEXTAREA_HEIGHT = 112

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
 *   isModelLoading: boolean,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 *   onInitializeModel: () => Promise<unknown>,
 *   onAskQuestion: (userQuery: string) => Promise<void>,
 *   onOpenMobileSidebar: () => void,
 * }} props - Chat messages, streaming state, and submit actions.
 * @returns {JSX.Element} The chat workspace.
 */
function ChatInterface({
  messages,
  currentStreamingReply,
  isGenerating,
  isModelReady,
  isModelLoading,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
  onInitializeModel,
  onAskQuestion,
  onOpenMobileSidebar,
}) {
  const [draftQuery, setDraftQuery] = useState('')
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentStreamingReply])

  useEffect(() => {
    resizeComposerTextarea(textareaRef.current)
  }, [draftQuery])

  async function handleSubmit(event) {
    event.preventDefault()
    await submitDraftQuery()
  }

  async function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }

    event.preventDefault()
    await submitDraftQuery()
  }

  async function submitDraftQuery() {
    const normalizedDraftQuery = draftQuery.trim()

    if (!normalizedDraftQuery || !isModelReady || isGenerating) {
      return
    }

    setDraftQuery('')

    try {
      await onAskQuestion(normalizedDraftQuery)
    } catch (error) {
      logFunctionError('ChatInterface.submitDraftQuery', error, {
        queryLength: normalizedDraftQuery.length,
      })
      setDraftQuery(normalizedDraftQuery)
    }
  }

  return (
    <section className="flex h-full min-w-0 flex-col" style={{ background: 'var(--panel-strong)' }}>
      <div className="flex-shrink-0 px-4 py-3 md:px-6">
        <ChatHeader
          messageCount={messages.length}
          isGenerating={isGenerating}
          isModelReady={isModelReady}
          isModelLoading={isModelLoading}
          availableFileNames={availableFileNames}
          activeFileNames={activeFileNames}
          toggleFileSelection={toggleFileSelection}
          onInitializeModel={onInitializeModel}
          onOpenMobileSidebar={onOpenMobileSidebar}
        />
      </div>

      <div className="docuhelp-scrollbar flex-1 overflow-y-auto px-4 py-4 md:px-6">
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
          <div className="flex h-full flex-col justify-center">
            <EmptyChatState isModelReady={isModelReady} isModelLoading={isModelLoading} />
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-3 md:px-6 md:py-4">
        <ChatComposer
          draftQuery={draftQuery}
          isGenerating={isGenerating}
          isModelReady={isModelReady}
          textareaRef={textareaRef}
          onDraftQueryChange={setDraftQuery}
          onKeyDown={handleComposerKeyDown}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  )
}

/**
 * Render the compact chat header with document selection and status controls.
 *
 * @param {{
 *   messageCount: number,
 *   isGenerating: boolean,
 *   isModelReady: boolean,
 *   isModelLoading: boolean,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 *   onInitializeModel: () => Promise<unknown>,
 *   onOpenMobileSidebar: () => void,
 * }} props - Summary state for the chat session.
 * @returns {JSX.Element} The compact chat header.
 */
function ChatHeader({
  messageCount,
  isGenerating,
  isModelReady,
  isModelLoading,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
  onInitializeModel,
  onOpenMobileSidebar,
}) {
  const headerRef = useRef(null)
  const [isCompactHeader, setIsCompactHeader] = useState(false)

  useEffect(() => {
    const headerElement = headerRef.current

    if (!headerElement) {
      return
    }

    const updateCompactHeaderState = () => {
      setIsCompactHeader(headerElement.clientWidth < 700)
    }

    updateCompactHeaderState()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateCompactHeaderState)

      return () => {
        window.removeEventListener('resize', updateCompactHeaderState)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updateCompactHeaderState()
    })

    resizeObserver.observe(headerElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <div ref={headerRef} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border transition lg:hidden"
            style={{
              borderColor: 'var(--panel-border)',
              background: 'var(--panel-muted)',
              color: 'var(--text-primary)',
            }}
            onClick={onOpenMobileSidebar}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          {!isCompactHeader ? (
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] lg:hidden"
              style={{ color: 'var(--text-muted)' }}
            >
              Query Documents
            </p>
          ) : null}
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
          {isModelReady ? (
            <StatusBadge
              label="Model ready"
              tone="ready"
            />
          ) : null}
          {!isModelReady && !isCompactHeader ? (
            <StatusBadge
              label="Model not ready"
              tone="idle"
            />
          ) : null}
          {!isModelReady ? (
            <button
              type="button"
              className="rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                borderColor: 'var(--accent)',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}
              onClick={() => {
                void onInitializeModel()
              }}
              disabled={isModelLoading}
            >
              {getInitializeButtonLabel(isModelLoading, isCompactHeader)}
            </button>
          ) : null}
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

function DocumentSelector({ availableFileNames, activeFileNames, toggleFileSelection }) {
  if (!availableFileNames.length) {
    return null
  }

  return (
    <div className="min-w-0 flex-1">
      <p
        className="hidden text-xs font-semibold uppercase tracking-[0.2em] lg:block"
        style={{ color: 'var(--text-muted)' }}
      >
        Query Documents
      </p>
      <div className="docuhelp-scrollbar flex gap-2 overflow-x-auto pb-1 lg:mt-2">
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

function DocumentSelectorPill({ fileName, isActive, toggleFileSelection }) {
  return (
    <button
      type="button"
      className="flex-shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition"
      style={{
        borderColor: isActive ? 'var(--accent)' : 'var(--panel-border)',
        background: isActive ? 'var(--accent-soft)' : 'var(--panel-muted)',
        color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
      }}
      onClick={() => toggleFileSelection(fileName)}
    >
      {fileName}
    </button>
  )
}

function ChatMessageBubble({ message }) {
  const isUserMessage = message.role === 'user'

  return (
    <div className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'}`}>
      <article
        className={`max-w-3xl rounded-[1.5rem] px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.10)] md:px-5 ${isUserMessage ? '' : 'border'
          }`}
        style={
          isUserMessage
            ? {
              background: 'var(--message-user-bg)',
              color: 'var(--message-user-text)',
            }
            : {
              background: 'var(--message-assistant-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--message-assistant-border)',
            }
        }
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
          {isUserMessage ? 'You' : 'DocuHelp'}
        </p>

        <div
          className={`docuhelp-prose mt-3 max-w-none prose prose-sm md:prose-base md:prose-p:leading-8 prose-p:leading-7 ${isUserMessage ? 'docuhelp-prose-inverse prose-invert' : ''
            }`}
          style={{ color: isUserMessage ? 'var(--message-user-text)' : 'var(--text-primary)' }}
        >
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

function StreamingMessageBubble({ currentStreamingReply }) {
  return (
    <div className="flex justify-start">
      <article
        className="max-w-3xl rounded-[1.5rem] border px-4 py-4 shadow-[0_18px_55px_rgba(15,23,42,0.10)] md:px-5"
        style={{
          borderColor: 'var(--accent)',
          background: 'var(--accent-soft)',
          color: 'var(--text-primary)',
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--accent)' }}
        >
          DocuHelp
        </p>
        <div
          className="docuhelp-prose mt-3 max-w-none prose prose-sm md:prose-base md:prose-p:leading-8 prose-p:leading-7"
          style={{ color: 'var(--text-primary)' }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {currentStreamingReply}
          </ReactMarkdown>
          <span
            className="ml-1 inline-block h-5 w-2 animate-pulse rounded-sm align-middle"
            style={{ background: 'var(--accent)' }}
          />
        </div>
      </article>
    </div>
  )
}

function CitationChipList({ citations }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {citations.map((citation) => (
        <CitationChip key={citation.citationLabel} citation={citation} />
      ))}
    </div>
  )
}

function CitationChip({ citation }) {
  const sourceFileName = extractSourceFileName(citation.citationLabel)
  const similarityPercentage = Math.round(citation.similarity * 100)

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-muted)',
        color: 'var(--text-secondary)',
      }}
      title={`${citation.citationLabel} | similarity ${similarityPercentage}%`}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: 'var(--accent)' }} />
      <span>{sourceFileName}</span>
    </span>
  )
}

function EmptyChatState({ isModelReady, isModelLoading }) {
  return (
    <div className="flex h-full min-h-[420px] items-center justify-center">
      <div
        className="max-w-xl rounded-[1.6rem] border px-6 py-8 text-center"
        style={{
          borderColor: 'var(--panel-border)',
          background: 'var(--panel-muted)',
        }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-[0.24em]"
          style={{ color: 'var(--accent)' }}
        >
          Ready when you are
        </p>
        <p className="mt-4 text-base leading-7" style={{ color: 'var(--text-secondary)' }}>
          {isModelReady
            ? 'Ask a question about your indexed documents to retrieve the most relevant chunks and stream a grounded answer.'
            : isModelLoading
              ? 'Your local model is loading. Once it finishes, you can ask questions against your indexed documents.'
              : 'Initialize the local model from the top status area, then start chatting with your indexed documents.'}
        </p>
      </div>
    </div>
  )
}

function ChatComposer({
  draftQuery,
  isGenerating,
  isModelReady,
  textareaRef,
  onDraftQueryChange,
  onKeyDown,
  onSubmit,
}) {
  const isSubmitDisabled = !draftQuery.trim() || !isModelReady || isGenerating

  return (
    <form className="w-full" onSubmit={onSubmit}>
      <div
        className="flex items-end gap-3 rounded-[1.6rem] border p-2.5 md:p-3"
        style={{
          borderColor: 'var(--composer-border)',
          background: 'var(--composer-bg)',
          boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div className="flex flex-1 items-end">
          <label className="sr-only" htmlFor="docuhelp-chat-input">
            Ask a question about your indexed documents
          </label>
          <textarea
            id="docuhelp-chat-input"
            ref={textareaRef}
            className="w-full resize-none bg-transparent px-3 py-3 text-sm leading-5 outline-none placeholder:opacity-70 md:py-3.5"
            style={{
              minHeight: '48px',
              maxHeight: `${MAX_TEXTAREA_HEIGHT}px`,
              color: 'var(--text-primary)',
              lineHeight: '1.25rem',
            }}
            placeholder="Ask a question grounded in your uploaded documents..."
            value={draftQuery}
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              void onKeyDown(event)
            }}
            disabled={isGenerating}
          />
        </div>

        <button
          type="submit"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45 md:h-12 md:w-12"
          style={{
            background: 'var(--accent)',
            color: 'var(--accent-contrast)',
          }}
          disabled={isSubmitDisabled}
          aria-label="Send message"
          title="Send message"
        >
          <SendHorizontal size={18} strokeWidth={2.2} />
        </button>
      </div>
    </form>
  )
}

function StatusBadge({ label, tone }) {
  const toneStyles = getStatusBadgeToneStyles(tone)

  return (
    <span
      className="rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] md:text-xs md:tracking-[0.18em]"
      style={toneStyles}
    >
      {label}
    </span>
  )
}

function getStatusBadgeToneStyles(tone) {
  if (tone === 'ready') {
    return {
      background: 'var(--success-soft)',
      color: 'var(--success-text)',
    }
  }

  if (tone === 'working') {
    return {
      background: 'var(--accent-soft)',
      color: 'var(--accent)',
    }
  }

  if (tone === 'idle') {
    return {
      background: 'var(--warning-soft)',
      color: 'var(--warning-text)',
    }
  }

  return {
    background: 'var(--panel-muted)',
    color: 'var(--text-secondary)',
  }
}

function getInitializeButtonLabel(isModelLoading, isCompactHeader) {
  if (isModelLoading) {
    return 'Loading model'
  }

  return isCompactHeader ? 'Model not ready' : 'Initialize model'
}

function resizeComposerTextarea(textareaElement) {
  if (!textareaElement) {
    return
  }

  textareaElement.style.height = `${DEFAULT_TEXTAREA_HEIGHT}px`
  textareaElement.style.height = `${Math.min(textareaElement.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
}

function extractSourceFileName(citationLabel) {
  if (!citationLabel.includes(' / chunk ')) {
    return citationLabel
  }

  return citationLabel.split(' / chunk ')[0]
}

export default ChatInterface
