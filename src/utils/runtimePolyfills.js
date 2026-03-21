/**
 * Install runtime polyfills required by the current dependency stack.
 *
 * @returns {void}
 */
export function installRuntimePolyfills() {
  installMapGetOrInsertComputedPolyfill()
}

/**
 * Polyfill `Map.prototype.getOrInsertComputed` for runtimes that do not implement it yet.
 * pdf.js currently expects this helper to exist in some execution paths.
 *
 * @returns {void}
 */
function installMapGetOrInsertComputedPolyfill() {
  if (typeof Map.prototype.getOrInsertComputed === 'function') {
    return
  }

  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    configurable: true,
    writable: true,
    /**
     * Return the stored value for a key, or compute/store it when absent.
     *
     * @param {unknown} key - Map key being looked up.
     * @param {(key: unknown) => unknown} computeValue - Factory used when the key is missing.
     * @returns {unknown} The existing or newly inserted value.
     */
    value(key, computeValue) {
      if (this.has(key)) {
        return this.get(key)
      }

      const computedValue = computeValue(key)
      this.set(key, computedValue)

      return computedValue
    },
  })
}
