/**
 * Write a structured error log to the browser console.
 *
 * @param {string} functionName - Name of the function that failed.
 * @param {unknown} error - The thrown error value.
 * @param {Record<string, unknown>} [context={}] - Extra debugging context for the failure.
 * @returns {void}
 */
export function logFunctionError(functionName, error, context = {}) {
  console.error(`[DocuHelp] ${functionName} failed.`, {
    error,
    context,
  })
}

/**
 * Log the failure and then rethrow it unchanged.
 *
 * @param {string} functionName - Name of the function that failed.
 * @param {unknown} error - The thrown error value.
 * @param {Record<string, unknown>} [context={}] - Extra debugging context for the failure.
 * @throws {unknown} Rethrows the original error after logging.
 */
export function logAndRethrow(functionName, error, context = {}) {
  logFunctionError(functionName, error, context)
  throw error
}

/**
 * Register broad browser error hooks so unexpected failures are always visible in the console.
 *
 * @returns {void}
 */
export function registerGlobalErrorLogging() {
  window.addEventListener('error', handleWindowError)
  window.addEventListener('unhandledrejection', handleUnhandledRejection)
}

/**
 * Log synchronous browser errors that bubble to the window.
 *
 * @param {ErrorEvent} event - Browser error event.
 * @returns {void}
 */
function handleWindowError(event) {
  logFunctionError('window.error', event.error ?? event.message, {
    filename: event.filename,
    lineNumber: event.lineno,
    columnNumber: event.colno,
  })
}

/**
 * Log unhandled promise rejections that escape normal flow control.
 *
 * @param {PromiseRejectionEvent} event - Browser unhandled rejection event.
 * @returns {void}
 */
function handleUnhandledRejection(event) {
  logFunctionError('window.unhandledrejection', event.reason)
}
