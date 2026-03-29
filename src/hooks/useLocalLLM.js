import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  checkWebGPUSupport,
  DEFAULT_WEB_LLM_MODEL_ID,
  getActiveEngine,
  initializeEngine as initializeLocalEngine,
  unloadActiveEngine,
} from '../services/llmService'
import { logFunctionError } from '../utils/logger'

/**
 * Manage the lifecycle of a browser-local WebLLM model from React state.
 *
 * @param {{
 *   modelId?: string,
 *   autoInitialize?: boolean,
 * }} [options={}] - Hook configuration.
 * @returns {{
 *   engine: import('@mlc-ai/web-llm').MLCEngine | null,
 *   isSupported: boolean | null,
 *   isLoading: boolean,
 *   progressText: string,
 *   progressValue: number,
 *   isReady: boolean,
 *   errorMessage: string,
 *   initializeModel: (requestedModelId?: string) => Promise<import('@mlc-ai/web-llm').MLCEngine | null>,
 *   unloadModel: () => Promise<void>,
 * }} Hook state and model lifecycle actions.
 */
export function useLocalLLM(options = {}) {
  const {
    modelId = DEFAULT_WEB_LLM_MODEL_ID,
    autoInitialize = false,
  } = options

  const isDisposedRef = useRef(false)
  const [engine, setEngine] = useState(() => getActiveEngine())
  const [isSupported, setIsSupported] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progressText, setProgressText] = useState('Waiting to initialize local model.')
  const [progressValue, setProgressValue] = useState(0)
  const [isReady, setIsReady] = useState(() => Boolean(getActiveEngine()))
  const [errorMessage, setErrorMessage] = useState('')
  const initializeModelEvent = useEffectEvent((requestedModelId) => initializeModel(requestedModelId))

  useEffect(() => {
    isDisposedRef.current = false
    void detectWebGPUSupport()

    return () => {
      isDisposedRef.current = true
    }
  }, [])

  useEffect(() => {
    if (!autoInitialize || isSupported !== true || isReady || isLoading) {
      return
    }

    void initializeModelEvent(modelId)
  }, [autoInitialize, isLoading, isReady, isSupported, modelId])

  /**
   * Check WebGPU support and update hook state for the loader UI.
   *
   * @returns {Promise<void>} Resolves after support detection finishes.
   */
  async function detectWebGPUSupport() {
    try {
      await checkWebGPUSupport()

      if (isDisposedRef.current) {
        return
      }

      setIsSupported(true)
      setErrorMessage('')
    } catch (error) {
      logFunctionError('useLocalLLM.detectWebGPUSupport', error)

      if (isDisposedRef.current) {
        return
      }

      setIsSupported(false)
      setErrorMessage(getReadableErrorMessage(error, 'WebGPU is unavailable on this device.'))
      setProgressText('WebGPU is unavailable.')
      setProgressValue(0)
    }
  }

  /**
   * Initialize the requested local model and mirror its loading progress into React state.
   *
   * @param {string} [requestedModelId=modelId] - Model id to load.
   * @returns {Promise<import('@mlc-ai/web-llm').MLCEngine | null>} The initialized engine or null on failure.
   */
  async function initializeModel(requestedModelId = modelId) {
    if (isLoading) {
      return engine
    }

    setIsLoading(true)
    setIsReady(false)
    setErrorMessage('')
    setProgressText('Preparing local model initialization...')
    setProgressValue(0)

    try {
      const initializedEngine = await initializeLocalEngine(
        requestedModelId,
        handleProgressUpdate,
      )

      if (isDisposedRef.current) {
        return initializedEngine
      }

      setEngine(initializedEngine)
      setIsSupported(true)
      setIsReady(true)
      setProgressText('Model ready.')
      setProgressValue(100)

      return initializedEngine
    } catch (error) {
      logFunctionError('useLocalLLM.initializeModel', error, {
        modelId: requestedModelId,
      })

      if (isDisposedRef.current) {
        return null
      }

      setEngine(null)
      setIsReady(false)
      setErrorMessage(getReadableErrorMessage(error, 'Unable to initialize the local model.'))

      return null
    } finally {
      if (!isDisposedRef.current) {
        setIsLoading(false)
      }
    }
  }

  /**
   * Unload the currently active local model and reset the loader state.
   *
   * @returns {Promise<void>} Resolves when the active engine has been released.
   */
  async function unloadModel() {
    try {
      await unloadActiveEngine()

      if (isDisposedRef.current) {
        return
      }

      setEngine(null)
      setIsReady(false)
      setIsLoading(false)
      setErrorMessage('')
      setProgressText('Local model cache cleared. Initialize a model to continue.')
      setProgressValue(0)
    } catch (error) {
      logFunctionError('useLocalLLM.unloadModel', error)

      if (isDisposedRef.current) {
        return
      }

      setErrorMessage(getReadableErrorMessage(error, 'Unable to unload the local model.'))
    }
  }

  /**
   * Mirror raw WebLLM progress reports into simple loader UI state.
   *
   * @param {{ text: string, progress: number }} progressReport - Raw WebLLM progress update.
   * @returns {void}
   */
  function handleProgressUpdate(progressReport) {
    if (isDisposedRef.current) {
      return
    }

    setProgressText(progressReport.text || 'Loading local model...')
    setProgressValue(normalizeProgressValue(progressReport.progress))
  }

  return {
    engine,
    isSupported,
    isLoading,
    progressText,
    progressValue,
    isReady,
    errorMessage,
    initializeModel,
    unloadModel,
  }
}

/**
 * Convert WebLLM's fractional progress into a stable 0-100 integer.
 *
 * @param {number} rawProgressValue - Fractional progress reported by WebLLM.
 * @returns {number} Progress percentage suitable for the UI.
 */
function normalizeProgressValue(rawProgressValue) {
  if (!Number.isFinite(rawProgressValue)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(rawProgressValue * 100)))
}

/**
 * Turn an unknown thrown value into a readable UI message.
 *
 * @param {unknown} error - Thrown error value.
 * @param {string} fallbackMessage - Message used when the error is not an Error instance.
 * @returns {string} Readable user-facing message.
 */
function getReadableErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage
}
