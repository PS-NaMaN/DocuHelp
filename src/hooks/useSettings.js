import { useEffect, useState } from 'react'
import { DEFAULT_WEB_LLM_MODEL_ID, getSupportedModelIds } from '../services/llmService'
import { logFunctionError } from '../utils/logger'

const OCR_SCALE_STORAGE_KEY = 'docuhelp:ocr-scale'
const GENERATION_SETTINGS_STORAGE_KEY = 'docuhelp:generation-settings'
const SELECTED_MODEL_STORAGE_KEY = 'docuhelp:selected-model-id'
const THEME_STORAGE_KEY = 'docuhelp:theme-name'
const CUSTOM_THEME_STORAGE_KEY = 'docuhelp:custom-theme-tokens'
const DEFAULT_OCR_SCALE = 2
const MIN_OCR_SCALE = 0.5
const MAX_OCR_SCALE = 5
const DEFAULT_THEME_NAME = 'light'
const SUPPORTED_THEME_NAMES = ['light', 'dark', 'amoled', 'custom']
const DEFAULT_GENERATION_SETTINGS = {
  temperature: 0.7,
  topP: 0.95,
  maxTokens: 512,
  presencePenalty: 0,
  frequencyPenalty: 0,
  repetitionPenalty: 1,
}
const DEFAULT_CUSTOM_THEME_TOKENS = {
  appBg: '#0b0b0c',
  panelBg: '#111214',
  panelMuted: '#16181b',
  panelStrong: '#111214',
  textPrimary: '#f8fafc',
  textSecondary: '#cbd5e1',
  textMuted: '#94a3b8',
  accent: '#22c55e',
  accentContrast: '#04130a',
}
const THEME_PRESETS = {
  light: {
    appBg: 'linear-gradient(180deg, #f5f7fb 0%, #eef4f7 100%)',
    panelBg: 'rgba(250, 252, 255, 0.88)',
    panelElevated: 'rgba(255, 255, 255, 0.94)',
    panelMuted: 'rgba(244, 247, 250, 0.94)',
    panelStrong: '#ffffff',
    panelBorder: 'rgba(148, 163, 184, 0.22)',
    panelShadow: '0 24px 80px rgba(15, 23, 42, 0.08)',
    textPrimary: '#111827',
    textSecondary: '#475569',
    textMuted: '#64748b',
    textInverse: '#f8fafc',
    accent: '#0f766e',
    accentSoft: 'rgba(15, 118, 110, 0.12)',
    accentStrong: '#14b8a6',
    accentContrast: '#ecfeff',
    messageUserText: '#f8fafc',
    successSoft: 'rgba(22, 163, 74, 0.12)',
    successText: '#15803d',
    warningSoft: 'rgba(217, 119, 6, 0.14)',
    warningText: '#b45309',
    dangerSoft: 'rgba(225, 29, 72, 0.12)',
    dangerText: '#be123c',
    composerBg: 'rgba(255, 255, 255, 0.76)',
    composerBorder: 'rgba(148, 163, 184, 0.2)',
    messageUserBg: '#0f766e',
    messageAssistantBg: 'rgba(15, 23, 42, 0.03)',
    messageAssistantBorder: 'rgba(148, 163, 184, 0.16)',
    scrollbarTrack: 'rgba(148, 163, 184, 0.12)',
    scrollbarThumb: 'rgba(15, 118, 110, 0.36)',
    scrollbarThumbHover: 'rgba(15, 118, 110, 0.56)',
    interactiveHoverShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
    interactiveHoverBorder: 'rgba(15, 118, 110, 0.28)',
    interactiveHoverBg: 'rgba(15, 118, 110, 0.08)',
  },
  dark: {
    appBg: 'linear-gradient(180deg, #0f172a 0%, #111827 100%)',
    panelBg: 'rgba(15, 23, 42, 0.84)',
    panelElevated: 'rgba(15, 23, 42, 0.94)',
    panelMuted: 'rgba(30, 41, 59, 0.88)',
    panelStrong: 'rgba(17, 24, 39, 0.98)',
    panelBorder: 'rgba(148, 163, 184, 0.16)',
    panelShadow: '0 24px 80px rgba(2, 6, 23, 0.32)',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    textInverse: '#e2e8f0',
    accent: '#2dd4bf',
    accentSoft: 'rgba(45, 212, 191, 0.16)',
    accentStrong: '#5eead4',
    accentContrast: '#0f172a',
    messageUserText: '#f8fafc',
    successSoft: 'rgba(34, 197, 94, 0.14)',
    successText: '#86efac',
    warningSoft: 'rgba(245, 158, 11, 0.18)',
    warningText: '#fcd34d',
    dangerSoft: 'rgba(251, 113, 133, 0.16)',
    dangerText: '#fda4af',
    composerBg: 'rgba(15, 23, 42, 0.88)',
    composerBorder: 'rgba(148, 163, 184, 0.16)',
    messageUserBg: '#115e59',
    messageAssistantBg: 'rgba(255, 255, 255, 0.04)',
    messageAssistantBorder: 'rgba(148, 163, 184, 0.12)',
    scrollbarTrack: 'rgba(148, 163, 184, 0.08)',
    scrollbarThumb: 'rgba(45, 212, 191, 0.28)',
    scrollbarThumbHover: 'rgba(45, 212, 191, 0.5)',
    interactiveHoverShadow: '0 18px 42px rgba(2, 6, 23, 0.42)',
    interactiveHoverBorder: 'rgba(94, 234, 212, 0.4)',
    interactiveHoverBg: 'rgba(45, 212, 191, 0.12)',
  },
  amoled: {
    appBg: '#000000',
    panelBg: '#000000',
    panelElevated: '#050505',
    panelMuted: '#0a0a0a',
    panelStrong: '#000000',
    panelBorder: 'rgba(255, 255, 255, 0.08)',
    panelShadow: '0 24px 80px rgba(0, 0, 0, 0.4)',
    textPrimary: '#fafafa',
    textSecondary: '#e5e7eb',
    textMuted: '#cbd5e1',
    textInverse: '#fafafa',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.18)',
    accentStrong: '#7dd3fc',
    accentContrast: '#001018',
    messageUserText: '#f8fafc',
    successSoft: 'rgba(34, 197, 94, 0.18)',
    successText: '#86efac',
    warningSoft: 'rgba(245, 158, 11, 0.2)',
    warningText: '#fcd34d',
    dangerSoft: 'rgba(244, 63, 94, 0.2)',
    dangerText: '#fda4af',
    composerBg: '#050505',
    composerBorder: 'rgba(255, 255, 255, 0.08)',
    messageUserBg: '#0c4a6e',
    messageAssistantBg: '#050505',
    messageAssistantBorder: 'rgba(255, 255, 255, 0.08)',
    scrollbarTrack: 'rgba(255, 255, 255, 0.06)',
    scrollbarThumb: 'rgba(56, 189, 248, 0.34)',
    scrollbarThumbHover: 'rgba(56, 189, 248, 0.58)',
    interactiveHoverShadow: '0 0 0 1px rgba(125, 211, 252, 0.2), 0 20px 44px rgba(0, 0, 0, 0.55)',
    interactiveHoverBorder: 'rgba(125, 211, 252, 0.45)',
    interactiveHoverBg: 'rgba(56, 189, 248, 0.12)',
  },
}

/**
 * Manage persisted user settings for OCR, theme selection, custom theme tokens, and local LLM generation behavior.
 *
 * @returns {{
 *   ocrScale: number,
 *   setOcrScale: (nextOcrScale: number | string) => void,
 *   themeName: string,
 *   setThemeName: (nextThemeName: string) => void,
 *   customThemeTokens: {
 *     appBg: string,
 *     panelBg: string,
 *     panelMuted: string,
 *     panelStrong: string,
 *     textPrimary: string,
 *     textSecondary: string,
 *     textMuted: string,
 *     accent: string,
 *     accentContrast: string,
 *   },
 *   updateCustomThemeToken: (tokenName: string, nextValue: string) => void,
 *   selectedModelId: string,
 *   setSelectedModelId: (nextModelId: string) => void,
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
  const [themeName, setThemeNameState] = useState(readStoredThemeName)
  const [customThemeTokens, setCustomThemeTokensState] = useState(readStoredCustomThemeTokens)
  const [selectedModelId, setSelectedModelIdState] = useState(readStoredSelectedModelId)
  const [generationSettings, setGenerationSettingsState] = useState(readStoredGenerationSettings)

  useEffect(() => {
    writeStoredOcrScale(ocrScale)
  }, [ocrScale])

  useEffect(() => {
    writeStoredThemeName(themeName)
    applyThemeToDocument(themeName, customThemeTokens)
  }, [themeName, customThemeTokens])

  useEffect(() => {
    writeStoredCustomThemeTokens(customThemeTokens)
  }, [customThemeTokens])

  useEffect(() => {
    writeStoredSelectedModelId(selectedModelId)
  }, [selectedModelId])

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
   * Persist the selected supported theme name.
   *
   * @param {string} nextThemeName - Requested theme name.
   * @returns {void}
   */
  function setThemeName(nextThemeName) {
    setThemeNameState(normalizeThemeName(nextThemeName))
  }

  /**
   * Persist one custom theme token value.
   *
   * @param {string} tokenName - Custom token key to update.
   * @param {string} nextValue - Raw color value selected by the user.
   * @returns {void}
   */
  function updateCustomThemeToken(tokenName, nextValue) {
    if (!(tokenName in DEFAULT_CUSTOM_THEME_TOKENS)) {
      return
    }

    setCustomThemeTokensState((previousTokens) => ({
      ...previousTokens,
      [tokenName]: normalizeColorToken(nextValue, previousTokens[tokenName]),
    }))
  }

  /**
   * Persist the selected supported local model id.
   *
   * @param {string} nextModelId - Requested supported model id.
   * @returns {void}
   */
  function setSelectedModelId(nextModelId) {
    setSelectedModelIdState(normalizeSelectedModelId(nextModelId))
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
    themeName,
    setThemeName,
    customThemeTokens,
    updateCustomThemeToken,
    selectedModelId,
    setSelectedModelId,
    generationSettings,
    updateGenerationSetting,
  }
}

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

function readStoredThemeName() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME_NAME
    }

    const storedThemeName = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (!storedThemeName) {
      return DEFAULT_THEME_NAME
    }

    return normalizeThemeName(storedThemeName)
  } catch (error) {
    logFunctionError('useSettings.readStoredThemeName', error)
    return DEFAULT_THEME_NAME
  }
}

function readStoredCustomThemeTokens() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_CUSTOM_THEME_TOKENS
    }

    const storedCustomThemeTokens = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY)

    if (!storedCustomThemeTokens) {
      return DEFAULT_CUSTOM_THEME_TOKENS
    }

    return normalizeCustomThemeTokens(JSON.parse(storedCustomThemeTokens))
  } catch (error) {
    logFunctionError('useSettings.readStoredCustomThemeTokens', error)
    return DEFAULT_CUSTOM_THEME_TOKENS
  }
}

function readStoredSelectedModelId() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_WEB_LLM_MODEL_ID
    }

    const storedSelectedModelId = window.localStorage.getItem(SELECTED_MODEL_STORAGE_KEY)

    if (!storedSelectedModelId) {
      return DEFAULT_WEB_LLM_MODEL_ID
    }

    return normalizeSelectedModelId(storedSelectedModelId)
  } catch (error) {
    logFunctionError('useSettings.readStoredSelectedModelId', error)
    return DEFAULT_WEB_LLM_MODEL_ID
  }
}

function readStoredGenerationSettings() {
  try {
    if (typeof window === 'undefined') {
      return DEFAULT_GENERATION_SETTINGS
    }

    const storedGenerationSettings = window.localStorage.getItem(GENERATION_SETTINGS_STORAGE_KEY)

    if (!storedGenerationSettings) {
      return DEFAULT_GENERATION_SETTINGS
    }

    return normalizeGenerationSettings(JSON.parse(storedGenerationSettings))
  } catch (error) {
    logFunctionError('useSettings.readStoredGenerationSettings', error)
    return DEFAULT_GENERATION_SETTINGS
  }
}

function writeStoredOcrScale(ocrScale) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(OCR_SCALE_STORAGE_KEY, ocrScale.toFixed(2))
  } catch (error) {
    logFunctionError('useSettings.writeStoredOcrScale', error, { ocrScale })
  }
}

function writeStoredThemeName(themeName) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themeName)
  } catch (error) {
    logFunctionError('useSettings.writeStoredThemeName', error, { themeName })
  }
}

function writeStoredCustomThemeTokens(customThemeTokens) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(customThemeTokens))
  } catch (error) {
    logFunctionError('useSettings.writeStoredCustomThemeTokens', error, { customThemeTokens })
  }
}

function writeStoredSelectedModelId(selectedModelId) {
  try {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, selectedModelId)
  } catch (error) {
    logFunctionError('useSettings.writeStoredSelectedModelId', error, { selectedModelId })
  }
}

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
    logFunctionError('useSettings.writeStoredGenerationSettings', error, { generationSettings })
  }
}

/**
 * Apply the active theme preset and optional custom overrides to the root document.
 *
 * @param {string} themeName - Theme name to apply.
 * @param {{
 *   appBg: string,
 *   panelBg: string,
 *   panelMuted: string,
 *   panelStrong: string,
 *   textPrimary: string,
 *   textSecondary: string,
 *   textMuted: string,
 *   accent: string,
 *   accentContrast: string,
 * }} customThemeTokens - Custom token values supplied by the user.
 * @returns {void}
 */
function applyThemeToDocument(themeName, customThemeTokens) {
  if (typeof document === 'undefined') {
    return
  }

  const documentElement = document.documentElement
  documentElement.dataset.theme = themeName

  const themeTokens =
    themeName === 'custom'
      ? createCustomThemePreset(customThemeTokens)
      : THEME_PRESETS[themeName] ?? THEME_PRESETS[DEFAULT_THEME_NAME]

  Object.entries(themeTokens).forEach(([tokenName, tokenValue]) => {
    documentElement.style.setProperty(toCssVariableName(tokenName), tokenValue)
  })
}

function normalizeOcrScale(rawOcrScale) {
  const parsedOcrScale = Number(rawOcrScale)

  if (!Number.isFinite(parsedOcrScale)) {
    return DEFAULT_OCR_SCALE
  }

  return Math.max(MIN_OCR_SCALE, Math.min(MAX_OCR_SCALE, parsedOcrScale))
}

function normalizeThemeName(rawThemeName) {
  if (SUPPORTED_THEME_NAMES.includes(rawThemeName)) {
    return rawThemeName
  }

  return DEFAULT_THEME_NAME
}

function normalizeSelectedModelId(rawModelId) {
  const supportedModelIds = getSupportedModelIds()

  if (supportedModelIds.includes(rawModelId)) {
    return rawModelId
  }

  return DEFAULT_WEB_LLM_MODEL_ID
}

function normalizeCustomThemeTokens(rawCustomThemeTokens) {
  return {
    appBg: normalizeColorToken(rawCustomThemeTokens.appBg, DEFAULT_CUSTOM_THEME_TOKENS.appBg),
    panelBg: normalizeColorToken(rawCustomThemeTokens.panelBg, DEFAULT_CUSTOM_THEME_TOKENS.panelBg),
    panelMuted: normalizeColorToken(rawCustomThemeTokens.panelMuted, DEFAULT_CUSTOM_THEME_TOKENS.panelMuted),
    panelStrong: normalizeColorToken(rawCustomThemeTokens.panelStrong, DEFAULT_CUSTOM_THEME_TOKENS.panelStrong),
    textPrimary: normalizeColorToken(rawCustomThemeTokens.textPrimary, DEFAULT_CUSTOM_THEME_TOKENS.textPrimary),
    textSecondary: normalizeColorToken(rawCustomThemeTokens.textSecondary, DEFAULT_CUSTOM_THEME_TOKENS.textSecondary),
    textMuted: normalizeColorToken(rawCustomThemeTokens.textMuted, DEFAULT_CUSTOM_THEME_TOKENS.textMuted),
    accent: normalizeColorToken(rawCustomThemeTokens.accent, DEFAULT_CUSTOM_THEME_TOKENS.accent),
    accentContrast: normalizeColorToken(rawCustomThemeTokens.accentContrast, DEFAULT_CUSTOM_THEME_TOKENS.accentContrast),
  }
}

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
 * Create the full token preset for the custom theme from a small user-editable token set.
 *
 * @param {{
 *   appBg: string,
 *   panelBg: string,
 *   panelMuted: string,
 *   panelStrong: string,
 *   textPrimary: string,
 *   textSecondary: string,
 *   textMuted: string,
 *   accent: string,
 *   accentContrast: string,
 * }} customThemeTokens - User-editable base theme tokens.
 * @returns {Record<string, string>} Full theme token preset for the custom theme.
 */
function createCustomThemePreset(customThemeTokens) {
  return {
    appBg: customThemeTokens.appBg,
    panelBg: customThemeTokens.panelBg,
    panelElevated: customThemeTokens.panelStrong,
    panelMuted: customThemeTokens.panelMuted,
    panelStrong: customThemeTokens.panelStrong,
    panelBorder: 'rgba(148, 163, 184, 0.18)',
    panelShadow: '0 24px 80px rgba(0, 0, 0, 0.22)',
    textPrimary: customThemeTokens.textPrimary,
    textSecondary: customThemeTokens.textSecondary,
    textMuted: customThemeTokens.textMuted,
    textInverse: customThemeTokens.textPrimary,
    accent: customThemeTokens.accent,
    accentSoft: colorWithAlpha(customThemeTokens.accent, 0.14),
    accentStrong: customThemeTokens.accent,
    accentContrast: customThemeTokens.accentContrast,
    messageUserText: customThemeTokens.accentContrast,
    successSoft: 'rgba(34, 197, 94, 0.14)',
    successText: '#86efac',
    warningSoft: 'rgba(245, 158, 11, 0.18)',
    warningText: '#fcd34d',
    dangerSoft: 'rgba(244, 63, 94, 0.16)',
    dangerText: '#fda4af',
    composerBg: customThemeTokens.panelStrong,
    composerBorder: 'rgba(148, 163, 184, 0.18)',
    messageUserBg: customThemeTokens.accent,
    messageAssistantBg: customThemeTokens.panelMuted,
    messageAssistantBorder: 'rgba(148, 163, 184, 0.16)',
    scrollbarTrack: 'rgba(148, 163, 184, 0.08)',
    scrollbarThumb: colorWithAlpha(customThemeTokens.accent, 0.4),
    scrollbarThumbHover: colorWithAlpha(customThemeTokens.accent, 0.62),
    interactiveHoverShadow: '0 16px 36px rgba(0, 0, 0, 0.22)',
    interactiveHoverBorder: colorWithAlpha(customThemeTokens.accent, 0.4),
    interactiveHoverBg: colorWithAlpha(customThemeTokens.accent, 0.12),
  }
}

function normalizeColorToken(rawValue, fallbackValue) {
  if (typeof rawValue !== 'string') {
    return fallbackValue
  }

  const trimmedValue = rawValue.trim()

  if (/^#[0-9a-fA-F]{6}$/.test(trimmedValue)) {
    return trimmedValue
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmedValue)) {
    return `#${trimmedValue[1]}${trimmedValue[1]}${trimmedValue[2]}${trimmedValue[2]}${trimmedValue[3]}${trimmedValue[3]}`
  }

  return fallbackValue
}

function colorWithAlpha(hexColor, alphaValue) {
  const normalizedHexColor = normalizeColorToken(hexColor, '#22c55e')
  const redChannel = Number.parseInt(normalizedHexColor.slice(1, 3), 16)
  const greenChannel = Number.parseInt(normalizedHexColor.slice(3, 5), 16)
  const blueChannel = Number.parseInt(normalizedHexColor.slice(5, 7), 16)

  return `rgba(${redChannel}, ${greenChannel}, ${blueChannel}, ${alphaValue})`
}

function toCssVariableName(tokenName) {
  return `--${tokenName.replace(/[A-Z]/g, (matchedCharacter) => `-${matchedCharacter.toLowerCase()}`)}`
}

function clampNumber(value, minimumValue, maximumValue) {
  return Math.max(minimumValue, Math.min(maximumValue, value))
}
