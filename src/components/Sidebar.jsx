import { useState } from 'react'
import LibraryModal from './LibraryModal'
import StatusPanel from './StatusPanel'
import UploadPanel from './UploadPanel'

/**
 * Render the branded sidebar header.
 *
 * @returns {JSX.Element} The sidebar hero section.
 */
function SidebarHero() {
  return (
    <div className="border-b px-6 py-6" style={{ borderColor: 'var(--panel-border)' }}>
      <h1
        className="cursor-pointer font-serif text-3xl leading-tight"
        style={{ color: 'var(--text-primary)' }}
        title="A private, in-browser document analyzer. Files stay on-device while text, chunks, and embeddings are indexed into local storage."
      >
        DocuHelp
      </h1>
    </div>
  )
}

/**
 * Render the sidebar settings launcher.
 *
 * @param {{ onOpenSettings: () => void }} props - Settings open handler.
 * @returns {JSX.Element} The settings button.
 */
function SettingsButton({ onOpenSettings }) {
  return (
    <button
      type="button"
      className="flex w-full flex-col gap-2 rounded-[1.4rem] border p-4 text-left transition"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-elevated)',
        color: 'var(--text-primary)',
      }}
      onClick={onOpenSettings}
    >
      <div className="flex w-full items-center justify-between">
        <p className="text-sm font-semibold">Settings</p>
        <span
          className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{
            borderColor: 'var(--panel-border)',
            background: 'var(--panel-muted)',
            color: 'var(--text-muted)',
          }}
        >
          Open
        </span>
      </div>
      <p className="text-[13px] leading-5" style={{ color: 'var(--text-secondary)' }}>
        Manage OCR, local models, and indexed data.
      </p>
    </button>
  )
}

/**
 * Render the collapsible "How DocuHelp Works" explainer with the current local-model status.
 *
 * @param {{
 *   isLocalLlmSupported: boolean | null,
 *   isLocalLlmLoading: boolean,
 *   localLlmProgressText: string,
 *   localLlmProgressValue: number,
 *   isLocalLlmReady: boolean,
 *   localLlmErrorMessage: string,
 * }} props - Loader state mirrored from the local LLM hook.
 * @returns {JSX.Element} One explainer card.
 */
function HowDocuHelpWorksCard({
  isLocalLlmSupported,
  isLocalLlmLoading,
  localLlmProgressText,
  localLlmProgressValue,
  isLocalLlmReady,
  localLlmErrorMessage,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const modelStatus = createModelStatusSummary({
    isLocalLlmSupported,
    isLocalLlmLoading,
    localLlmProgressText,
    localLlmProgressValue,
    isLocalLlmReady,
    localLlmErrorMessage,
  })

  return (
    <section
      className="rounded-[1.4rem] border"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-elevated)',
      }}
    >
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-4 text-left"
        onClick={() => setIsExpanded((previousValue) => !previousValue)}
      >
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--accent)' }}
          >
            How DocuHelp Works
          </p>
          <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Private local RAG pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{
              background: modelStatus.badgeBackground,
              color: modelStatus.badgeText,
            }}
          >
            {modelStatus.badgeLabel}
          </span>
          <span
            className="text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            {isExpanded ? 'Hide' : 'Open'}
          </span>
        </div>
      </button>

      {isExpanded ? (
        <div className="space-y-3 border-t p-4 pt-3" style={{ borderColor: 'var(--panel-border)' }}>
          <div
            className="rounded-[1rem] border px-4 py-3"
            style={{
              borderColor: 'var(--panel-border)',
              background: 'var(--panel-muted)',
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--accent)' }}
            >
              WebGPU
            </p>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
              {modelStatus.description}
            </p>
          </div>

          <HowItWorksRow
            label="Parsing"
            value="pdf.js + markdown token walker + plain text reader"
          />
          <HowItWorksRow
            label="Chunking"
            value="~400 token windows with 50 token overlap"
          />
          <HowItWorksRow
            label="Embeddings"
            value="transformers.js MiniLM vectors in browser cache"
          />
          <HowItWorksRow
            label="Local LLM"
            value="WebLLM engine cached and compiled with WebGPU"
          />
          <HowItWorksRow
            label="Retrieval"
            value="Cosine similarity over Float32Array chunk embeddings"
          />
          <HowItWorksRow
            label="Storage"
            value="IndexedDB survives refresh with chunk metadata"
          />
        </div>
      ) : null}
    </section>
  )
}

/**
 * Render one explainer row inside the pipeline card.
 *
 * @param {{ label: string, value: string }} props - One explainer label/value pair.
 * @returns {JSX.Element} One explainer row.
 */
function HowItWorksRow({ label, value }) {
  return (
    <div
      className="rounded-[1rem] border px-4 py-3"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-muted)',
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'var(--accent)' }}
      >
        {label}
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        {value}
      </p>
    </div>
  )
}

/**
 * Convert model-loader state into a compact status badge and helper text.
 *
 * @param {{
 *   isLocalLlmSupported: boolean | null,
 *   isLocalLlmLoading: boolean,
 *   localLlmProgressText: string,
 *   localLlmProgressValue: number,
 *   isLocalLlmReady: boolean,
 *   localLlmErrorMessage: string,
 * }} modelState - Loader state mirrored from the local LLM hook.
 * @returns {{ badgeLabel: string, badgeBackground: string, badgeText: string, description: string }} Presentational status summary.
 */
function createModelStatusSummary(modelState) {
  if (modelState.isLocalLlmReady) {
    return {
      badgeLabel: 'Ready',
      badgeBackground: 'var(--success-soft)',
      badgeText: 'var(--success-text)',
      description:
        'The local WebGPU engine is initialized and ready for private in-browser inference.',
    }
  }

  if (modelState.isLocalLlmLoading) {
    return {
      badgeLabel: `${modelState.localLlmProgressValue}%`,
      badgeBackground: 'var(--accent-soft)',
      badgeText: 'var(--accent)',
      description: modelState.localLlmProgressText || 'Loading the local WebGPU model.',
    }
  }

  if (modelState.isLocalLlmSupported === false) {
    return {
      badgeLabel: 'Unsupported',
      badgeBackground: 'var(--warning-soft)',
      badgeText: 'var(--warning-text)',
      description:
        modelState.localLlmErrorMessage ||
        'WebGPU is unavailable on this device, so local model inference cannot start here.',
    }
  }

  return {
    badgeLabel: 'Idle',
    badgeBackground: 'var(--panel-muted)',
    badgeText: 'var(--text-muted)',
    description:
      'Initialize the local model from the composer below when you are ready to start asking questions.',
  }
}

/**
 * Render the left sidebar with upload, status, library, and settings controls.
 *
 * @param {{
 *   storedDocuments: Array<Record<string, unknown>>,
 *   storageSummary: { documentCount: number, chunkCount: number },
 *   ingestionProgress: { stage: string, fileName: string, message: string },
 *   progressPercentage: number,
 *   errorMessage: string,
 *   isIngestingDocuments: boolean,
 *   deletingDocumentFileName: string,
 *   isLocalLlmSupported: boolean | null,
 *   isLocalLlmLoading: boolean,
 *   localLlmProgressText: string,
 *   localLlmProgressValue: number,
 *   isLocalLlmReady: boolean,
 *   localLlmErrorMessage: string,
 *   onFileUpload: (event: { target: HTMLInputElement }) => Promise<void>,
 *   onDeleteDocument: (fileName: string) => Promise<void>,
 *   onOpenSettings: () => void,
 * }} props - Sidebar display and event props.
 * @returns {JSX.Element} The sidebar panel.
 */
function Sidebar({
  storedDocuments,
  storageSummary,
  ingestionProgress,
  progressPercentage,
  errorMessage,
  isIngestingDocuments,
  deletingDocumentFileName,
  isLocalLlmSupported,
  isLocalLlmLoading,
  localLlmProgressText,
  localLlmProgressValue,
  isLocalLlmReady,
  localLlmErrorMessage,
  onFileUpload,
  onDeleteDocument,
  onOpenSettings,
}) {
  return (
    <aside
      className="z-10 flex h-full w-72 flex-shrink-0 flex-col border-r"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-bg)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      <div className="docuhelp-scrollbar flex-1 space-y-6 overflow-y-auto">
        <SidebarHero />
        <div className="space-y-6 px-6 pb-6">
          <UploadPanel
            isIngestingDocuments={isIngestingDocuments}
            onFileUpload={onFileUpload}
          />
          <StatusPanel
            ingestionProgress={ingestionProgress}
            progressPercentage={progressPercentage}
            storageSummary={storageSummary}
            errorMessage={errorMessage}
          />
          <LibraryModal
            storedDocuments={storedDocuments}
            deletingFileName={deletingDocumentFileName}
            onDeleteDocument={onDeleteDocument}
          />
          <SettingsButton onOpenSettings={onOpenSettings} />
          <HowDocuHelpWorksCard
            isLocalLlmSupported={isLocalLlmSupported}
            isLocalLlmLoading={isLocalLlmLoading}
            localLlmProgressText={localLlmProgressText}
            localLlmProgressValue={localLlmProgressValue}
            isLocalLlmReady={isLocalLlmReady}
            localLlmErrorMessage={localLlmErrorMessage}
          />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
