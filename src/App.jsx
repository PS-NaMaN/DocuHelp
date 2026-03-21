import { useEffect, useState } from 'react'
import { ingestDocuments } from './services/ingestionService'
import {
  deleteAllIndexedData,
  getStoredDocuments,
  getStorageSummary,
} from './services/libraryService'

const ACCEPTED_FILE_TYPES =
  '.pdf,.md,.markdown,.txt,text/plain,application/pdf,text/markdown'

const INITIAL_PROGRESS_STATE = {
  stage: 'idle',
  fileName: '',
  current: 0,
  total: 0,
  message: 'Upload PDF, Markdown, or text files to start building your local knowledge base.',
}

/**
 * Render the DocuHelp Phase 1 workspace and coordinate ingestion state.
 *
 * @returns {JSX.Element} The main application shell.
 */
function App() {
  const [storedDocuments, setStoredDocuments] = useState([])
  const [storageSummary, setStorageSummary] = useState({ documentCount: 0, chunkCount: 0 })
  const [isIngestingDocuments, setIsIngestingDocuments] = useState(false)
  const [isDeletingIndexedData, setIsDeletingIndexedData] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [ingestionProgress, setIngestionProgress] = useState(INITIAL_PROGRESS_STATE)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    void refreshLibraryState()
  }, [])

  /**
   * Reload the locally stored document list and summary counts from IndexedDB.
   *
   * @returns {Promise<void>} Resolves when the sidebar state has been updated.
   */
  async function refreshLibraryState() {
    const librarySnapshot = await loadLibrarySnapshot()

    setStoredDocuments(librarySnapshot.documents)
    setStorageSummary(librarySnapshot.summary)
  }

  /**
   * Ingest the selected files and refresh the local library snapshot afterward.
   *
   * @param {{ target: HTMLInputElement }} event - Browser file input change event.
   * @returns {Promise<void>} Resolves when ingestion completes or fails.
   */
  async function handleFileUpload(event) {
    const selectedFiles = Array.from(event.target.files ?? [])

    if (!selectedFiles.length) {
      return
    }

    beginIngestion(selectedFiles)

    try {
      await ingestDocuments(selectedFiles, setIngestionProgress)
      await refreshLibraryState()
      setIngestionProgress(createCompletedProgressState(selectedFiles.length))
    } catch (ingestionError) {
      const readableErrorMessage = getErrorMessage(ingestionError, 'Ingestion failed.')

      setErrorMessage(readableErrorMessage)
      setIngestionProgress(createErroredProgressState(selectedFiles.length))
    } finally {
      setIsIngestingDocuments(false)
      event.target.value = ''
    }
  }

  /**
   * Delete all locally indexed data after a final browser confirmation.
   *
   * @returns {Promise<void>} Resolves when deletion completes or the user cancels.
   */
  async function handleDeleteIndexedData() {
    if (!shouldDeleteIndexedData()) {
      return
    }

    setIsDeletingIndexedData(true)
    setErrorMessage('')

    try {
      await deleteAllIndexedData()
      await refreshLibraryState()
      setIngestionProgress(createDeletedProgressState())
      closeSettingsModal()
    } catch (deleteError) {
      setErrorMessage(getErrorMessage(deleteError, 'Unable to delete indexed data.'))
    } finally {
      setIsDeletingIndexedData(false)
    }
  }

  /**
   * Open the settings modal.
   *
   * @returns {void}
   */
  function openSettingsModal() {
    setIsSettingsModalOpen(true)
  }

  /**
   * Close the settings modal.
   *
   * @returns {void}
   */
  function closeSettingsModal() {
    setIsSettingsModalOpen(false)
  }

  /**
   * Prime the UI state for a new ingestion batch.
   *
   * @param {File[]} selectedFiles - Files the user is about to ingest.
   * @returns {void}
   */
  function beginIngestion(selectedFiles) {
    setErrorMessage('')
    setIsIngestingDocuments(true)
    setIngestionProgress(createUploadStartProgressState(selectedFiles))
  }

  const progressPercentage = calculateProgressPercentage(ingestionProgress)

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_22%),linear-gradient(135deg,_#f6f3ee_0%,_#fffdf9_36%,_#fff9f0_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 lg:px-6 lg:py-6">
        <div className="grid flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Sidebar
            storedDocuments={storedDocuments}
            storageSummary={storageSummary}
            ingestionProgress={ingestionProgress}
            progressPercentage={progressPercentage}
            errorMessage={errorMessage}
            isIngestingDocuments={isIngestingDocuments}
            onFileUpload={handleFileUpload}
            onOpenSettings={openSettingsModal}
          />
          <MainWorkspace />
        </div>
      </div>

      {isSettingsModalOpen ? (
        <SettingsModal
          isDeletingIndexedData={isDeletingIndexedData}
          onClose={closeSettingsModal}
          onDeleteIndexedData={handleDeleteIndexedData}
        />
      ) : null}
    </div>
  )
}

/**
 * Fetch the current document list and summary counts in parallel.
 *
 * @returns {Promise<{ documents: Array<Record<string, unknown>>, summary: { documentCount: number, chunkCount: number } }>} Current library snapshot.
 */
async function loadLibrarySnapshot() {
  const [documents, summary] = await Promise.all([getStoredDocuments(), getStorageSummary()])

  return { documents, summary }
}

/**
 * Calculate a progress bar percentage from the current ingestion state.
 *
 * @param {{ stage: string, current: number, total: number }} ingestionProgress - Current progress state.
 * @returns {number} Progress percentage between 0 and 100.
 */
function calculateProgressPercentage(ingestionProgress) {
  if (!ingestionProgress.total) {
    return ingestionProgress.stage === 'done' ? 100 : 0
  }

  return Math.min(100, Math.round((ingestionProgress.current / ingestionProgress.total) * 100))
}

/**
 * Build the initial progress state for a newly selected upload batch.
 *
 * @param {File[]} selectedFiles - Files the user selected.
 * @returns {{ stage: string, fileName: string, current: number, total: number, message: string }} Progress state for upload start.
 */
function createUploadStartProgressState(selectedFiles) {
  return {
    stage: 'loading',
    fileName: selectedFiles[0].name,
    current: 0,
    total: selectedFiles.length,
    message: 'Preparing files for extraction...',
  }
}

/**
 * Build the final progress state shown after successful ingestion.
 *
 * @param {number} fileCount - Number of files ingested in the completed batch.
 * @returns {{ stage: string, fileName: string, current: number, total: number, message: string }} Success progress state.
 */
function createCompletedProgressState(fileCount) {
  return {
    stage: 'done',
    fileName: '',
    current: fileCount,
    total: fileCount,
    message: `Finished indexing ${fileCount} file${fileCount > 1 ? 's' : ''} in your browser.`,
  }
}

/**
 * Build the progress state shown when ingestion aborts with an error.
 *
 * @param {number} fileCount - Number of files that were part of the attempted batch.
 * @returns {{ stage: string, fileName: string, current: number, total: number, message: string }} Error progress state.
 */
function createErroredProgressState(fileCount) {
  return {
    stage: 'error',
    fileName: '',
    current: 0,
    total: fileCount,
    message: 'The ingestion pipeline stopped before completion.',
  }
}

/**
 * Build the progress state shown after all locally indexed data has been removed.
 *
 * @returns {{ stage: string, fileName: string, current: number, total: number, message: string }} Deletion success state.
 */
function createDeletedProgressState() {
  return {
    stage: 'idle',
    fileName: '',
    current: 0,
    total: 0,
    message: 'All locally indexed data for this site has been deleted from your browser.',
  }
}

/**
 * Convert an unknown thrown value into a user-facing error message.
 *
 * @param {unknown} thrownError - The caught error value.
 * @param {string} fallbackMessage - Default message when the error is not an Error instance.
 * @returns {string} A readable message for the UI.
 */
function getErrorMessage(thrownError, fallbackMessage) {
  return thrownError instanceof Error ? thrownError.message : fallbackMessage
}

/**
 * Ask the browser for final confirmation before deleting local indexed data.
 *
 * @returns {boolean} True when the user confirms deletion.
 */
function shouldDeleteIndexedData() {
  return window.confirm(
    'Delete all indexed data stored by DocuHelp on this site? This removes your locally indexed documents, chunks, and embeddings from this browser only.',
  )
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
 *   onFileUpload: (event: { target: HTMLInputElement }) => Promise<void>,
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
  onFileUpload,
  onOpenSettings,
}) {
  return (
    <aside className="overflow-hidden rounded-[2rem] border border-stone-200/80 bg-white/88 shadow-[0_24px_80px_rgba(28,25,23,0.08)] backdrop-blur">
      <SidebarHero />

      <div className="space-y-6 p-6">
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
        <LibraryPanel storedDocuments={storedDocuments} />
        <SettingsButton onOpenSettings={onOpenSettings} />
      </div>
    </aside>
  )
}

/**
 * Render the branded sidebar header.
 *
 * @returns {JSX.Element} The sidebar hero section.
 */
function SidebarHero() {
  return (
    <div className="border-b border-stone-200/80 bg-[linear-gradient(135deg,_rgba(8,145,178,0.08),_rgba(251,146,60,0.14))] px-6 py-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">Phase 1</p>
      <h1 className="mt-3 font-serif text-3xl leading-tight text-stone-950">DocuHelp</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-stone-600">
        A private, in-browser document analyzer. Files stay on-device while text, chunks,
        and embeddings are indexed into local storage.
      </p>
    </div>
  )
}

/**
 * Render the upload control card.
 *
 * @param {{
 *   isIngestingDocuments: boolean,
 *   onFileUpload: (event: { target: HTMLInputElement }) => Promise<void>,
 * }} props - Upload state and change handler.
 * @returns {JSX.Element} The upload panel.
 */
function UploadPanel({ isIngestingDocuments, onFileUpload }) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-cyan-300 bg-cyan-50/80 p-5">
      <p className="text-sm font-semibold text-cyan-900">Upload documents</p>
      <p className="mt-2 text-sm leading-6 text-cyan-800/80">
        Accepts PDF, Markdown, and plain text. Embeddings are generated in the browser with
        `all-MiniLM-L6-v2`.
      </p>
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[1.2rem] border border-cyan-200 bg-white px-4 py-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50">
        <span className="text-sm font-medium text-stone-800">Choose one or more files</span>
        <span className="mt-2 text-xs uppercase tracking-[0.24em] text-stone-500">
          PDF / MD / TXT
        </span>
        <input
          className="sr-only"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={onFileUpload}
          disabled={isIngestingDocuments}
        />
      </label>
    </section>
  )
}

/**
 * Render the current ingestion status card.
 *
 * @param {{
 *   ingestionProgress: { stage: string, fileName: string, message: string },
 *   progressPercentage: number,
 *   storageSummary: { documentCount: number, chunkCount: number },
 *   errorMessage: string,
 * }} props - Current progress and summary values.
 * @returns {JSX.Element} The status panel.
 */
function StatusPanel({
  ingestionProgress,
  progressPercentage,
  storageSummary,
  errorMessage,
}) {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">Index status</p>
          <p className="mt-1 text-sm text-stone-600">{ingestionProgress.message}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          {ingestionProgress.stage}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,_#0891b2,_#f97316)] transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Documents" value={storageSummary.documentCount} />
        <StatCard label="Chunks" value={storageSummary.chunkCount} />
      </div>

      {ingestionProgress.fileName ? (
        <p className="mt-4 truncate text-sm text-stone-500">
          Working on <span className="font-medium text-stone-700">{ingestionProgress.fileName}</span>
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

/**
 * Render the locally indexed document list.
 *
 * @param {{ storedDocuments: Array<Record<string, unknown>> }} props - Stored document list.
 * @returns {JSX.Element} The library panel.
 */
function LibraryPanel({ storedDocuments }) {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-900">Library</p>
        <p className="text-xs uppercase tracking-[0.22em] text-stone-400">IndexedDB</p>
      </div>

      <div className="mt-4 space-y-3">
        {storedDocuments.length ? (
          storedDocuments.map((storedDocument) => (
            <LibraryDocumentCard key={storedDocument.id} storedDocument={storedDocument} />
          ))
        ) : (
          <EmptyLibraryState />
        )}
      </div>
    </section>
  )
}

/**
 * Render a single indexed document card in the library.
 *
 * @param {{ storedDocument: { id: number, name: string, extension: string, chunkCount: number, embeddingDimensions: number } }} props - Indexed document metadata.
 * @returns {JSX.Element} A document card row.
 */
function LibraryDocumentCard({ storedDocument }) {
  return (
    <article className="rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{storedDocument.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
            {storedDocument.extension} / {storedDocument.chunkCount} chunks
          </p>
        </div>
        <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-stone-500">
          {storedDocument.embeddingDimensions}d
        </span>
      </div>
    </article>
  )
}

/**
 * Render the empty state shown before any documents have been indexed.
 *
 * @returns {JSX.Element} The empty library placeholder.
 */
function EmptyLibraryState() {
  return (
    <div className="rounded-[1.2rem] border border-dashed border-stone-200 px-4 py-5 text-sm leading-6 text-stone-500">
      No local documents yet. Upload a file to run extraction, chunking, embedding, and
      persistence entirely in the browser.
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
      className="flex w-full items-center justify-between rounded-[1.4rem] border border-stone-200 bg-white px-5 py-4 text-left transition hover:border-stone-300 hover:bg-stone-50"
      onClick={onOpenSettings}
    >
      <div>
        <p className="text-sm font-semibold text-stone-900">Settings</p>
        <p className="mt-1 text-sm text-stone-500">Manage local indexed data stored by this site.</p>
      </div>
      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        Open
      </span>
    </button>
  )
}

/**
 * Render the placeholder main workspace for later query phases.
 *
 * @returns {JSX.Element} The main content panel.
 */
function MainWorkspace() {
  return (
    <main className="flex min-h-[720px] flex-col overflow-hidden rounded-[2rem] border border-stone-200/80 bg-stone-950 text-stone-100 shadow-[0_24px_80px_rgba(28,25,23,0.12)]">
      <div className="border-b border-white/10 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Retrieval Workspace
        </p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight text-white">
          Query and citation flow comes next once the local knowledge base is ready.
        </h2>
      </div>

      <div className="grid flex-1 gap-4 p-6 lg:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5">
          <p className="text-sm font-semibold text-white">Future chat panel</p>
          <div className="mt-4 flex h-full min-h-[320px] flex-col justify-between rounded-[1.3rem] border border-dashed border-white/12 bg-black/10 p-5">
            <div>
              <p className="text-sm text-stone-300">
                Phase 1 stores chunked embeddings locally. Phase 2 will load WebLLM, confirm
                WebGPU support, and cache the selected model for offline-ready generation.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-stone-400 md:grid-cols-3">
              <PlaceholderTile title="Phase 2" body="Model loading and fallback UX" />
              <PlaceholderTile title="Phase 3" body="Similarity search and prompt assembly" />
              <PlaceholderTile title="Phase 4" body="Chat polish, citations, deployment" />
            </div>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,_rgba(8,145,178,0.08),_rgba(255,255,255,0.03))] p-5">
          <p className="text-sm font-semibold text-white">Pipeline notes</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
            <InfoPill label="Parsing" value="pdf.js + markdown token walker + plain text reader" />
            <InfoPill label="Chunking" value="~400 token windows with 50 token overlap" />
            <InfoPill label="Embeddings" value="transformers.js MiniLM vectors in browser cache" />
            <InfoPill label="Storage" value="IndexedDB survives refresh with chunk metadata" />
          </div>
        </section>
      </div>
    </main>
  )
}

/**
 * Render the settings modal for destructive local data actions.
 *
 * @param {{
 *   isDeletingIndexedData: boolean,
 *   onClose: () => void,
 *   onDeleteIndexedData: () => Promise<void>,
 * }} props - Settings modal action props.
 * @returns {JSX.Element} The modal overlay.
 */
function SettingsModal({ isDeletingIndexedData, onClose, onDeleteIndexedData }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_30px_120px_rgba(28,25,23,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              Settings
            </p>
            <h3 className="mt-3 font-serif text-3xl leading-tight text-stone-950">
              Local indexed data
            </h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Delete all document chunks and embeddings saved by DocuHelp in this browser for
              this site only.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-stone-200 px-3 py-2 text-sm font-medium text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
            onClick={onClose}
            disabled={isDeletingIndexedData}
          >
            Close
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5">
          <p className="text-sm font-semibold text-rose-900">Delete indexed data</p>
          <p className="mt-2 text-sm leading-6 text-rose-800/85">
            This clears all uploaded document records, chunks, and embeddings stored in
            IndexedDB by this site. It does not affect files outside this browser.
          </p>
          <button
            type="button"
            className="mt-4 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
            onClick={onDeleteIndexedData}
            disabled={isDeletingIndexedData}
          >
            {isDeletingIndexedData ? 'Deleting...' : 'Delete all indexed data'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Render a compact stat card used in the sidebar summary.
 *
 * @param {{ label: string, value: number }} props - Summary label and numeric value.
 * @returns {JSX.Element} A small stat card.
 */
function StatCard({ label, value }) {
  return (
    <div className="rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  )
}

/**
 * Render a roadmap tile in the future-work panel.
 *
 * @param {{ title: string, body: string }} props - Tile heading and supporting text.
 * @returns {JSX.Element} A roadmap tile.
 */
function PlaceholderTile({ title, body }) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{title}</p>
      <p className="mt-2 text-sm text-stone-300">{body}</p>
    </div>
  )
}

/**
 * Render a labeled pipeline note card in the main workspace.
 *
 * @param {{ label: string, value: string }} props - Note label and value text.
 * @returns {JSX.Element} A pipeline note card.
 */
function InfoPill({ label, value }) {
  return (
    <div className="rounded-[1.2rem] border border-white/10 bg-black/10 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">{label}</p>
      <p className="mt-2 text-sm text-stone-200">{value}</p>
    </div>
  )
}

export default App
