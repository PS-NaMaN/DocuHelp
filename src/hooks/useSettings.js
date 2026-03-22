import { useEffect, useState } from 'react'
import { logFunctionError } from '../utils/logger'

const OCR_SCALE_STORAGE_KEY = 'docuhelp:ocr-scale'
const GENERATION_SETTINGS_STORAGE_KEY = 'docuhelp:generation-settings'
const DEFAULT_OCR_SCALE = 2
const MIN_OCR_SCALE = 0.5
const MAX_OCR_SCALE = 5
const DEFAULT_GENERATION_SETTINGS = {
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 512,
  presencePenalty: 0,
  frequencyPenalty: 0,
  repetitionPenalty: 1,
}

/**
 * Manage persisted user settings for OCR and local LLM generation behavior.
 *
 * @returns {{
 *   ocrScale: number,
 *   setOcrScale: (nextOcrScale: number | string) => void,
 *   generationSettings: {
 *     temperature: number,
 *     topP: number,
 *     maxTokens: number,
 *     presencePenalty: number,
 *     frequencyPenalty: number,
 *     repetitionPenalty: number,
 *   },
 *   updateGenerationSetting: (settingName: string, nextValue: number | string) => void,
 * }} Settings state and safe update helpers.
 */
export function useSettings() {
  const [ocrScale, setOcrScaleState] = useState(readStoredOcrScale)
  const [generationSettings, setGenerationSettingsState] = useState(readStoredGenerationSettings)

  useEffect(() => {
    writeStoredOcrScale(ocrScale)
  }, [ocrScale])

  useEffect(() => {
    writeStoredGenerationSettings(generationSettings)
  }, [generationSettings])

  /**
   * Clamp and persist the user's preferred OCR scale value.
   *
   * @param {number | string} nextOcrScale - Raw slider or numeric input value.
   * @returns {void}
   */
  function setOcrScale(nextOcrScale) {
    setOcrScaleState(normalizeOcrScale(nextOcrScale))
  }

  /**
   * Update one persisted generation setting using a normalized numeric value.
   *
   * @param {string} settingName - Generation setting key to update.
   * @param {number | string} nextValue - Raw slider or numeric input value.
   * @returns {void}
   */
  function updateGenerationSetting(settingName, nextValue) {
    if (!(settingName in DEFAULT_GENERATION_SETTINGS)) {
      return
    }

    setGenerationSettingsState((previousGenerationSettings) => ({
      ...previousGenerationSettings,
      [settingName]: normalizeGenerationSettingValue(settingName, nextValue),
    }))
  }

  return {
    ocrScale,
    setOcrScale,
    generationSettings,
    updateGenerationSetting,
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
 * Read the stored generation settings from localStorage with safe fallbacks per field.
 *
 * @returns {{
 *   temperature: number,
 *   topP: number,
 *   maxTokens: number,
 *   presencePenalty: number,
 *   frequencyPenalty: number,
 *   repetitionPenalty: number,
 * }} Stored or default generation settings.
 */
function readStoredGenerationSettings() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_GENERATION_SETTINGS
    }

    const storedGenerationSettings = window.localStorage.getItem(GENERATION_SETTINGS_STORAGE_KEY)

    if (!storedGenerationSettings) {
      return DEFAULT_GENERATION_SETTINGS
    }

    const parsedGenerationSettings = JSON.parse(storedGenerationSettings)

    return normalizeGenerationSettings(parsedGenerationSettings)
  } catch (error) {
    logFunctionError('useSettings.readStoredGenerationSettings', error)

    return DEFAULT_GENERATION_SETTINGS
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
 * Persist generation settings to localStorage for future page loads.
 *
 * @param {Record<string, number>} generationSettings - Current generation settings object.
 * @returns {void}
 */
function writeStoredGenerationSettings(generationSettings) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(
      GENERATION_SETTINGS_STORAGE_KEY,
      JSON.stringify(generationSettings),
    )
  } catch (error) {
    logFunctionError('useSettings.writeStoredGenerationSettings', error, {
      generationSettings,
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

/**
 * Normalize every supported generation setting key using the correct bounds.
 *
 * @param {Record<string, unknown>} rawGenerationSettings - Untrusted parsed settings object.
 * @returns {{
 *   temperature: number,
 *   topP: number,
 *   maxTokens: number,
 *   presencePenalty: number,
 *   frequencyPenalty: number,
 *   repetitionPenalty: number,
 * }} Fully normalized generation settings.
 */
function normalizeGenerationSettings(rawGenerationSettings) {
  return {
    temperature: normalizeGenerationSettingValue('temperature', rawGenerationSettings.temperature),
    topP: normalizeGenerationSettingValue('topP', rawGenerationSettings.topP),
    maxTokens: normalizeGenerationSettingValue('maxTokens', rawGenerationSettings.maxTokens),
    presencePenalty: normalizeGenerationSettingValue(
      'presencePenalty',
      rawGenerationSettings.presencePenalty,
    ),
    frequencyPenalty: normalizeGenerationSettingValue(
      'frequencyPenalty',
      rawGenerationSettings.frequencyPenalty,
    ),
    repetitionPenalty: normalizeGenerationSettingValue(
      'repetitionPenalty',
      rawGenerationSettings.repetitionPenalty,
    ),
  }
}

/**
 * Clamp one generation setting to the range supported by the UI and request layer.
 *
 * @param {string} settingName - Generation setting key to normalize.
 * @param {number | string | undefined} rawValue - Untrusted setting value.
 * @returns {number} Normalized numeric generation setting.
 */
function normalizeGenerationSettingValue(settingName, rawValue) {
  const parsedValue = Number(rawValue)

  if (!Number.isFinite(parsedValue)) {
    return DEFAULT_GENERATION_SETTINGS[settingName]
  }

  if (settingName === 'temperature') {
    return clampNumber(parsedValue, 0, 2)
  }

  if (settingName === 'topP') {
    return clampNumber(parsedValue, 0, 1)
  }

  if (settingName === 'maxTokens') {
    return Math.round(clampNumber(parsedValue, 1, 4096))
  }

  if (settingName === 'presencePenalty' || settingName === 'frequencyPenalty') {
    return clampNumber(parsedValue, -2, 2)
  }

  if (settingName === 'repetitionPenalty') {
    return clampNumber(parsedValue, 0.8, 2)
  }

  return DEFAULT_GENERATION_SETTINGS.temperature
}

/**
 * Clamp a numeric value between the provided minimum and maximum bounds.
 *
 * @param {number} value - Numeric value to clamp.
 * @param {number} minimumValue - Inclusive lower bound.
 * @param {number} maximumValue - Inclusive upper bound.
 * @returns {number} Clamped numeric value.
 */
function clampNumber(value, minimumValue, maximumValue) {
  return Math.max(minimumValue, Math.min(maximumValue, value))
}
