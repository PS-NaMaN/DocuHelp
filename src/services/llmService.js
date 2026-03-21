import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm'
import { logAndRethrow } from '../utils/logger'

export const DEFAULT_WEB_LLM_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC'

let activeEngine = null
let activeModelId = null

/**
 * Check whether the current browser exposes a usable WebGPU implementation.
 *
 * @returns {Promise<boolean>} True when a compatible WebGPU adapter is available.
 * @throws {Error} Throws a descriptive error when WebGPU is unsupported or unavailable.
 */
export async function checkWebGPUSupport() {
  try {
    validateBrowserEnvironment()
    validateWebGPUAvailability()

    const gpuAdapter = await navigator.gpu.requestAdapter()

    if (gpuAdapter) {
      return true
    }

    throw new Error(
      'WebGPU is available in this browser, but no compatible GPU adapter was found on this device.',
    )
  } catch (error) {
    logAndRethrow('checkWebGPUSupport', error)
  }
}

/**
 * Initialize a local WebLLM engine and stream model-loading progress to the caller.
 *
 * @param {string} [modelId=DEFAULT_WEB_LLM_MODEL_ID] - Model id to load from WebLLM's prebuilt config.
 * @param {(progress: { text: string, progress: number, timeElapsed: number }) => void} [progressCallback] - Optional initialization progress callback.
 * @returns {Promise<import('@mlc-ai/web-llm').MLCEngine>} Initialized WebLLM engine.
 * @throws {Error} Throws when WebGPU is unsupported or the requested model is unavailable.
 */
export async function initializeEngine(
  modelId = DEFAULT_WEB_LLM_MODEL_ID,
  progressCallback,
) {
  try {
    await checkWebGPUSupport()
    validateModelId(modelId)

    if (shouldReuseActiveEngine(modelId)) {
      return activeEngine
    }

    reportInitializationProgress(progressCallback, {
      text: 'Checking WebGPU support...',
      progress: 0,
      timeElapsed: 0,
    })

    const initializedEngine = await CreateMLCEngine(modelId, {
      initProgressCallback: (progressReport) =>
        reportInitializationProgress(progressCallback, progressReport),
    })

    activeEngine = initializedEngine
    activeModelId = modelId

    return initializedEngine
  } catch (error) {
    logAndRethrow('initializeEngine', error, {
      modelId,
    })
  }
}

/**
 * Return the currently active engine instance, if one has already been loaded.
 *
 * @returns {import('@mlc-ai/web-llm').MLCEngine | null} The active engine or null.
 */
export function getActiveEngine() {
  return activeEngine
}

/**
 * Return the model id currently loaded into the active engine.
 *
 * @returns {string | null} Loaded model id or null.
 */
export function getActiveModelId() {
  return activeModelId
}

/**
 * Unload the active model and release WebLLM resources.
 *
 * @returns {Promise<void>} Resolves after the active engine has been unloaded.
 */
export async function unloadActiveEngine() {
  try {
    if (!activeEngine) {
      return
    }

    await activeEngine.unload()
    activeEngine = null
    activeModelId = null
  } catch (error) {
    logAndRethrow('unloadActiveEngine', error, {
      modelId: activeModelId,
    })
  }
}

/**
 * Return the list of prebuilt model ids available in the installed WebLLM package.
 *
 * @returns {string[]} Available prebuilt model ids.
 */
export function getAvailableModelIds() {
  return prebuiltAppConfig.model_list.map((modelRecord) => modelRecord.model_id)
}

/**
 * Ensure the code is running in a browser-like environment.
 *
 * @returns {void}
 * @throws {Error} Throws when browser APIs are unavailable.
 */
function validateBrowserEnvironment() {
  if (typeof navigator !== 'undefined') {
    return
  }

  throw new Error('WebLLM initialization requires a browser environment with navigator access.')
}

/**
 * Ensure the browser exposes the WebGPU entry point.
 *
 * @returns {void}
 * @throws {Error} Throws when WebGPU is not exposed by the browser.
 */
function validateWebGPUAvailability() {
  if ('gpu' in navigator) {
    return
  }

  throw new Error(
    'WebGPU is not available in this browser. Please use a WebGPU-compatible browser and device.',
  )
}

/**
 * Validate that the requested model exists in WebLLM's installed prebuilt model list.
 *
 * @param {string} modelId - Model id requested by the caller.
 * @returns {void}
 * @throws {Error} Throws when the model id is unknown.
 */
function validateModelId(modelId) {
  const availableModelIds = getAvailableModelIds()

  if (availableModelIds.includes(modelId)) {
    return
  }

  throw new Error(
    `Model "${modelId}" is not available in the installed WebLLM prebuilt configuration.`,
  )
}

/**
 * Decide whether the previously loaded engine can be reused as-is.
 *
 * @param {string} modelId - Requested model id.
 * @returns {boolean} True when the active engine already matches the request.
 */
function shouldReuseActiveEngine(modelId) {
  return Boolean(activeEngine && activeModelId === modelId)
}

/**
 * Safely forward engine initialization progress to the caller.
 *
 * @param {((progress: { text: string, progress: number, timeElapsed: number }) => void) | undefined} progressCallback - Optional caller callback.
 * @param {{ text: string, progress: number, timeElapsed: number }} progressReport - Raw WebLLM progress report.
 * @returns {void}
 */
function reportInitializationProgress(progressCallback, progressReport) {
  progressCallback?.(progressReport)
}
