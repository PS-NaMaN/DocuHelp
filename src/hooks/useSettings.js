import { useEffect, useState } from 'react'
import { logFunctionError } from '../utils/logger'

const OCR_SCALE_STORAGE_KEY = 'docuhelp:ocr-scale'
const DEFAULT_OCR_SCALE = 2
const MIN_OCR_SCALE = 0.5
const MAX_OCR_SCALE = 5

/**
 * Manage persisted user settings for local OCR behavior.
 *
 * @returns {{
 *   ocrScale: number,
 *   setOcrScale: (nextOcrScale: number | string) => void,
 * }} Settings state and safe update helpers.
 */
export function useSettings() {
  const [ocrScale, setOcrScaleState] = useState(readStoredOcrScale)

  useEffect(() => {
    writeStoredOcrScale(ocrScale)
  }, [ocrScale])

  /**
   * Clamp and persist the user's preferred OCR scale value.
   *
   * @param {number | string} nextOcrScale - Raw slider or numeric input value.
   * @returns {void}
   */
  function setOcrScale(nextOcrScale) {
    setOcrScaleState(normalizeOcrScale(nextOcrScale))
  }

  return {
    ocrScale,
    setOcrScale,
  }
}

/**
 * Read the stored OCR scale from localStorage, falling back safely when unavailable.
 *
 * @returns {number} Stored OCR scale or the default value.
 */
function readStoredOcrScale() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_OCR_SCALE
    }

    const storedOcrScale = window.localStorage.getItem(OCR_SCALE_STORAGE_KEY)

    if (!storedOcrScale) {
      return DEFAULT_OCR_SCALE
    }

    return normalizeOcrScale(storedOcrScale)
  } catch (error) {
    logFunctionError('useSettings.readStoredOcrScale', error)

    return DEFAULT_OCR_SCALE
  }
}

/**
 * Persist the OCR scale to localStorage for future page loads.
 *
 * @param {number} ocrScale - Current OCR scale preference.
 * @returns {void}
 */
function writeStoredOcrScale(ocrScale) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(OCR_SCALE_STORAGE_KEY, ocrScale.toFixed(2))
  } catch (error) {
    logFunctionError('useSettings.writeStoredOcrScale', error, {
      ocrScale,
    })
  }
}

/**
 * Clamp OCR scale input to the supported range and coerce invalid values safely.
 *
 * @param {number | string} rawOcrScale - Untrusted OCR scale input.
 * @returns {number} Normalized OCR scale inside the supported bounds.
 */
function normalizeOcrScale(rawOcrScale) {
  const parsedOcrScale = Number(rawOcrScale)

  if (!Number.isFinite(parsedOcrScale)) {
    return DEFAULT_OCR_SCALE
  }

  return Math.max(MIN_OCR_SCALE, Math.min(MAX_OCR_SCALE, parsedOcrScale))
}
