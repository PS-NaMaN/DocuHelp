import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
import ModelLoader from './components/ModelLoader'
import SettingsModal from './components/SettingsModal'
import { useLocalLLM } from './hooks/useLocalLLM'
import { useRagQuery } from './hooks/useRagQuery'
import { useSettings } from './hooks/useSettings'
import { ingestDocuments } from './services/ingestionService'
import {
  deleteAllIndexedData,
  deleteDocumentByFileName,
  getStoredDocuments,
  getStorageSummary,
  getUniqueStoredFiles,
} from './services/libraryService'
import {
  DEFAULT_WEB_LLM_MODEL_ID,
  getActiveModelId,
} from './services/llmService'

const INITIAL_PROGRESS_STATE = {
  stage: 'idle',
  fileName: '',
  current: 0,
  total: 0,
  message: 'Upload PDF, Markdown, or text files to start building your local knowledge base.',
}

/**
 * Render the DocuHelp application shell and coordinate ingestion, retrieval, and settings state.
 *
 * @returns {JSX.Element} The main application shell.
 */
function App() {
  const [storedDocuments, setStoredDocuments] = useState([])
  const [availableFileNames, setAvailableFileNames] = useState([])
  const [storageSummary, setStorageSummary] = useState({ documentCount: 0, chunkCount: 0 })
  const [isIngestingDocuments, setIsIngestingDocuments] = useState(false)
  const [isDeletingIndexedData, setIsDeletingIndexedData] = useState(false)
  const [deletingDocumentFileName, setDeletingDocumentFileName] = useState('')
  const [isChangingModel, setIsChangingModel] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [ingestionProgress, setIngestionProgress] = useState(INITIAL_PROGRESS_STATE)
  const [errorMessage, setErrorMessage] = useState('')
  const {
    ocrScale,
    setOcrScale,
    generationSettings,
    updateGenerationSetting,
  } = useSettings()
  const {
    engine,
    isSupported: isLocalLlmSupported,
    isLoading: isLocalLlmLoading,
    progressText: localLlmProgressText,
    progressValue: localLlmProgressValue,
    isReady: isLocalLlmReady,
    errorMessage: localLlmErrorMessage,
    initializeModel,
  } = useLocalLLM()
  const {
    messages,
    isGenerating,
    currentStreamingReply,
    activeFileNames,
    setActiveFileNames,
    toggleFileSelection,
    askQuestion,
  } = useRagQuery({ engine, generationSettings })

  useEffect(() => {
    async function loadInitialLibraryState() {
      const librarySnapshot = await loadLibrarySnapshot()

      setStoredDocuments(librarySnapshot.documents)
      setAvailableFileNames(librarySnapshot.uniqueFileNames)
      setStorageSummary(librarySnapshot.summary)
      setActiveFileNames((previousActiveFileNames) =>
        syncActiveFileNamesWithAvailableFiles(
          previousActiveFileNames,
          librarySnapshot.uniqueFileNames,
        ),
      )
    }

    void loadInitialLibraryState()
  }, [setActiveFileNames])

  /**
   * Reload the locally stored document list and summary counts from IndexedDB.
   *
   * @returns {Promise<void>} Resolves when the sidebar state has been updated.
   */
  async function refreshLibraryState() {
    const librarySnapshot = await loadLibrarySnapshot()

    setStoredDocuments(librarySnapshot.documents)
    setAvailableFileNames(librarySnapshot.uniqueFileNames)
    setStorageSummary(librarySnapshot.summary)
    setActiveFileNames((previousActiveFileNames) =>
      syncActiveFileNamesWithAvailableFiles(previousActiveFileNames, librarySnapshot.uniqueFileNames),
    )
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
      await ingestDocuments(selectedFiles, setIngestionProgress, {
        ocrScale,
      })
      await refreshLibraryState()
      setIngestionProgress(createCompletedProgressState(selectedFiles.length))
    } catch (ingestionError) {
      setErrorMessage(getErrorMessage(ingestionError, 'Ingestion failed.'))
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
      setActiveFileNames([])
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
   * Delete one indexed document after a browser confirmation prompt.
   *
   * @param {string} fileName - File name whose local chunks should be removed.
   * @returns {Promise<void>} Resolves when the document deletion flow finishes.
   */
  async function handleDeleteDocument(fileName) {
    if (!shouldDeleteDocument(fileName)) {
      return
    }

    setDeletingDocumentFileName(fileName)
    setErrorMessage('')

    try {
      await deleteDocumentByFileName(fileName)
      setActiveFileNames((previousActiveFileNames) =>
        previousActiveFileNames.filter((activeFileName) => activeFileName !== fileName),
      )
      await refreshLibraryState()
    } catch (deleteError) {
      setErrorMessage(getErrorMessage(deleteError, `Unable to delete ${fileName}.`))
    } finally {
      setDeletingDocumentFileName('')
    }
  }

  /**
   * Initialize a different local model from the settings modal.
   *
   * @param {string} modelId - Requested WebLLM model id.
   * @returns {Promise<void>} Resolves when the selected model finishes loading or fails.
   */
  async function handleChangeModel(modelId) {
    if (!modelId) {
      return
    }

    setIsChangingModel(true)

    try {
      await initializeModel(modelId)
    } finally {
      setIsChangingModel(false)
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
    <div className="flex h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_22%),linear-gradient(135deg,_#f6f3ee_0%,_#fffdf9_36%,_#fff9f0_100%)] text-stone-900">
      <Sidebar
            storedDocuments={storedDocuments}
            storageSummary={storageSummary}
            ingestionProgress={ingestionProgress}
            progressPercentage={progressPercentage}
            errorMessage={errorMessage}
            isIngestingDocuments={isIngestingDocuments}
            deletingDocumentFileName={deletingDocumentFileName}
            onFileUpload={handleFileUpload}
            onDeleteDocument={handleDeleteDocument}
            onOpenSettings={openSettingsModal}
          />
          <MainWorkspace
            isLocalLlmSupported={isLocalLlmSupported}
            isLocalLlmLoading={isLocalLlmLoading}
            localLlmProgressText={localLlmProgressText}
            localLlmProgressValue={localLlmProgressValue}
            isLocalLlmReady={isLocalLlmReady}
            localLlmErrorMessage={localLlmErrorMessage}
            onInitializeModel={initializeModel}
            messages={messages}
            isGenerating={isGenerating}
            currentStreamingReply={currentStreamingReply}
            availableFileNames={availableFileNames}
            activeFileNames={activeFileNames}
            toggleFileSelection={toggleFileSelection}
            onAskQuestion={askQuestion}
          />

      {isSettingsModalOpen ? (
        <SettingsModal
          isDeletingIndexedData={isDeletingIndexedData}
          isChangingModel={isChangingModel}
          currentModelId={getActiveModelId() ?? DEFAULT_WEB_LLM_MODEL_ID}
          availableModelIds={[DEFAULT_WEB_LLM_MODEL_ID]}
          ocrScale={ocrScale}
          generationSettings={generationSettings}
          onClose={closeSettingsModal}
          onDeleteIndexedData={handleDeleteIndexedData}
          onChangeOcrScale={setOcrScale}
          onChangeGenerationSetting={updateGenerationSetting}
          onChangeModel={handleChangeModel}
        />
      ) : null}
    </div>
  )
}

/**
 * Fetch the current document list and summary counts in parallel.
 *
 * @returns {Promise<{ documents: Array<Record<string, unknown>>, uniqueFileNames: string[], summary: { documentCount: number, chunkCount: number } }>} Current library snapshot.
 */
async function loadLibrarySnapshot() {
  const [documents, uniqueFileNames, summary] = await Promise.all([
    getStoredDocuments(),
    getUniqueStoredFiles(),
    getStorageSummary(),
  ])

  return { documents, uniqueFileNames, summary }
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
 * Ask the browser for final confirmation before deleting one local document index.
 *
 * @param {string} fileName - File name targeted for deletion.
 * @returns {boolean} True when the user confirms deletion.
 */
function shouldDeleteDocument(fileName) {
  return window.confirm(
    `Delete the indexed data for "${fileName}" from this browser on this site?`,
  )
}

/**
 * Keep active file filters aligned with the current stored document list.
 *
 * @param {string[]} previousActiveFileNames - Previously selected active file names.
 * @param {string[]} availableFileNames - Current file names available for retrieval.
 * @returns {string[]} Active file names that still exist, or all stored files when no selection exists yet.
 */
function syncActiveFileNamesWithAvailableFiles(previousActiveFileNames, availableFileNames) {
  if (!previousActiveFileNames.length) {
    return availableFileNames
  }

  return previousActiveFileNames.filter((activeFileName) => availableFileNames.includes(activeFileName))
}



/**
 * Render the main workspace including chat and model loader panels.
 *
 * @param {{
 *   isLocalLlmSupported: boolean | null,
 *   isLocalLlmLoading: boolean,
 *   localLlmProgressText: string,
 *   localLlmProgressValue: number,
 *   isLocalLlmReady: boolean,
 *   localLlmErrorMessage: string,
 *   onInitializeModel: () => Promise<unknown>,
 *   messages: Array<{
 *     id: string,
 *     role: 'user' | 'assistant',
 *     content: string,
 *     citations?: Array<{ citationLabel: string, similarity: number }>,
 *   }>,
 *   isGenerating: boolean,
 *   currentStreamingReply: string,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 *   onAskQuestion: (userQuery: string) => Promise<void>,
 * }} props - Model loader state and query state for the main workspace.
 * @returns {JSX.Element} The main content panel.
 */
function MainWorkspace({
  isLocalLlmSupported,
  isLocalLlmLoading,
  localLlmProgressText,
  localLlmProgressValue,
  isLocalLlmReady,
  localLlmErrorMessage,
  onInitializeModel,
  messages,
  isGenerating,
  currentStreamingReply,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
  onAskQuestion,
}) {
  const showInitializeButton =
    isLocalLlmSupported === true && !isLocalLlmLoading && !isLocalLlmReady

  return (
    <main className="flex-1 flex flex-col h-full relative bg-stone-950 text-stone-100 shadow-[0_24px_80px_rgba(28,25,23,0.12)]">
      <div className="flex-shrink-0 border-b border-white/10 px-6 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
          Retrieval Workspace
        </p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-tight text-white">
          Chat with your local document index, stream grounded answers, and inspect the cited sources.
        </h2>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:flex-row">
        <div className="flex-1 flex flex-col min-w-0">
          <ChatInterface
          messages={messages}
          currentStreamingReply={currentStreamingReply}
          isGenerating={isGenerating}
          isModelReady={isLocalLlmReady}
          availableFileNames={availableFileNames}
          activeFileNames={activeFileNames}
          toggleFileSelection={toggleFileSelection}
            onAskQuestion={onAskQuestion}
          />
        </div>

        <section className="w-full lg:w-80 flex-shrink-0 overflow-y-auto border-l border-white/10 bg-[linear-gradient(180deg,_rgba(8,145,178,0.08),_rgba(255,255,255,0.03))] p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Model loading</p>
            {showInitializeButton ? (
              <button
                type="button"
                className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-cyan-300"
                onClick={() => {
                  void onInitializeModel()
                }}
              >
                Initialize Local Model
              </button>
            ) : null}
          </div>

          <ModelLoader
            isSupported={isLocalLlmSupported}
            isLoading={isLocalLlmLoading}
            progressText={localLlmProgressText}
            progressValue={localLlmProgressValue}
            isReady={isLocalLlmReady}
            errorMessage={localLlmErrorMessage}
          />

          <div className="space-y-3 text-sm leading-6 text-stone-300">
            <InfoPill label="Parsing" value="pdf.js + markdown token walker + plain text reader" />
            <InfoPill label="Chunking" value="~400 token windows with 50 token overlap" />
            <InfoPill label="Embeddings" value="transformers.js MiniLM vectors in browser cache" />
            <InfoPill label="Local LLM" value="WebLLM engine cached and compiled with WebGPU" />
            <InfoPill label="Retrieval" value="Cosine similarity over Float32Array chunk embeddings" />
            <InfoPill label="Storage" value="IndexedDB survives refresh with chunk metadata" />
          </div>
        </section>
      </div>
    </main>
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
