import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatInterface from './components/ChatInterface'
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
  deleteSupportedModelCaches,
  getActiveModelId,
  getSupportedModelOptions,
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
  const [isDeletingLlmCache, setIsDeletingLlmCache] = useState(false)
  const [isDeletingIndexedData, setIsDeletingIndexedData] = useState(false)
  const [deletingDocumentFileName, setDeletingDocumentFileName] = useState('')
  const [isChangingModel, setIsChangingModel] = useState(false)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [ingestionProgress, setIngestionProgress] = useState(INITIAL_PROGRESS_STATE)
  const [errorMessage, setErrorMessage] = useState('')
  const {
    ocrScale,
    setOcrScale,
    themeName,
    setThemeName,
    customThemeTokens,
    updateCustomThemeToken,
    selectedModelId,
    setSelectedModelId,
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
    unloadModel,
  } = useLocalLLM({ modelId: selectedModelId })
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
      syncActiveFileNamesWithAvailableFiles(
        previousActiveFileNames,
        librarySnapshot.uniqueFileNames,
      ),
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
   * Delete cached local-model artifacts after a browser confirmation.
   *
   * @returns {Promise<void>} Resolves when cache deletion completes or the user cancels.
   */
  async function handleDeleteLlmCache() {
    if (!shouldDeleteLlmCache()) {
      return
    }

    setIsDeletingLlmCache(true)
    setErrorMessage('')

    try {
      await unloadModel()
      await deleteSupportedModelCaches()
      closeSettingsModal()
    } catch (deleteError) {
      setErrorMessage(getErrorMessage(deleteError, 'Unable to delete the local model cache.'))
    } finally {
      setIsDeletingLlmCache(false)
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
    setSelectedModelId(modelId)

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
    <div
      className="flex h-screen w-full overflow-hidden"
      data-theme={themeName}
      style={{
        background: 'var(--app-bg)',
        color: 'var(--text-primary)',
      }}
    >
      <Sidebar
        storedDocuments={storedDocuments}
        storageSummary={storageSummary}
        ingestionProgress={ingestionProgress}
        progressPercentage={progressPercentage}
        errorMessage={errorMessage}
        isIngestingDocuments={isIngestingDocuments}
        deletingDocumentFileName={deletingDocumentFileName}
        isLocalLlmSupported={isLocalLlmSupported}
        isLocalLlmLoading={isLocalLlmLoading}
        localLlmProgressText={localLlmProgressText}
        localLlmProgressValue={localLlmProgressValue}
        isLocalLlmReady={isLocalLlmReady}
        localLlmErrorMessage={localLlmErrorMessage}
        onFileUpload={handleFileUpload}
        onDeleteDocument={handleDeleteDocument}
        onOpenSettings={openSettingsModal}
      />

      <MainWorkspace
        messages={messages}
        isGenerating={isGenerating}
        currentStreamingReply={currentStreamingReply}
        isLocalLlmReady={isLocalLlmReady}
        isLocalLlmLoading={isLocalLlmLoading}
        availableFileNames={availableFileNames}
        activeFileNames={activeFileNames}
        toggleFileSelection={toggleFileSelection}
        onInitializeModel={initializeModel}
        onAskQuestion={askQuestion}
      />

      {isSettingsModalOpen ? (
        <SettingsModal
          isDeletingLlmCache={isDeletingLlmCache}
          isDeletingIndexedData={isDeletingIndexedData}
          isChangingModel={isChangingModel}
          currentModelId={getActiveModelId() ?? selectedModelId ?? DEFAULT_WEB_LLM_MODEL_ID}
          availableModels={getSupportedModelOptions()}
          ocrScale={ocrScale}
          themeName={themeName}
          customThemeTokens={customThemeTokens}
          generationSettings={generationSettings}
          onClose={closeSettingsModal}
          onDeleteLlmCache={handleDeleteLlmCache}
          onDeleteIndexedData={handleDeleteIndexedData}
          onChangeOcrScale={setOcrScale}
          onChangeTheme={setThemeName}
          onChangeCustomThemeToken={updateCustomThemeToken}
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
 * Ask the browser for final confirmation before deleting local WebLLM caches.
 *
 * @returns {boolean} True when the user confirms deletion.
 */
function shouldDeleteLlmCache() {
  return window.confirm(
    'Delete the cached local LLM files stored by DocuHelp on this site? This removes downloaded WebLLM model artifacts from this browser only.',
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
 * Render the main chat workspace without the old right-hand model panel.
 *
 * @param {{
 *   messages: Array<{
 *     id: string,
 *     role: 'user' | 'assistant',
 *     content: string,
 *     citations?: Array<{ citationLabel: string, similarity: number }>,
 *   }>,
 *   isGenerating: boolean,
 *   currentStreamingReply: string,
 *   isLocalLlmReady: boolean,
 *   isLocalLlmLoading: boolean,
 *   availableFileNames: string[],
 *   activeFileNames: string[],
 *   toggleFileSelection: (fileName: string) => void,
 *   onInitializeModel: () => Promise<unknown>,
 *   onAskQuestion: (userQuery: string) => Promise<void>,
 * }} props - Main chat workspace state and actions.
 * @returns {JSX.Element} The main content panel.
 */
function MainWorkspace({
  messages,
  isGenerating,
  currentStreamingReply,
  isLocalLlmReady,
  isLocalLlmLoading,
  availableFileNames,
  activeFileNames,
  toggleFileSelection,
  onInitializeModel,
  onAskQuestion,
}) {
  return (
    <main className="relative flex h-full flex-1 flex-col">
      <ChatInterface
        messages={messages}
        currentStreamingReply={currentStreamingReply}
        isGenerating={isGenerating}
        isModelReady={isLocalLlmReady}
        isModelLoading={isLocalLlmLoading}
        availableFileNames={availableFileNames}
        activeFileNames={activeFileNames}
        toggleFileSelection={toggleFileSelection}
        onInitializeModel={onInitializeModel}
        onAskQuestion={onAskQuestion}
      />
    </main>
  )
}

export default App
