import { useMemo, useState } from 'react'

/**
 * Render the settings modal for OCR preferences, local storage actions, and LLM controls.
 *
 * @param {{
 *   isDeletingIndexedData: boolean,
 *   isChangingModel: boolean,
 *   currentModelId: string,
 *   availableModelIds: string[],
 *   ocrScale: number,
 *   generationSettings: {
 *     temperature: number,
 *     topP: number,
 *     maxTokens: number,
 *     presencePenalty: number,
 *     frequencyPenalty: number,
 *     repetitionPenalty: number,
 *   },
 *   onClose: () => void,
 *   onDeleteIndexedData: () => Promise<void>,
 *   onChangeOcrScale: (nextOcrScale: number | string) => void,
 *   onChangeGenerationSetting: (settingName: string, nextValue: number | string) => void,
 *   onChangeModel: (modelId: string) => Promise<void>,
 * }} props - Settings values and actions.
 * @returns {JSX.Element} The modal overlay.
 */
function SettingsModal({
  isDeletingIndexedData,
  isChangingModel,
  currentModelId,
  availableModelIds,
  ocrScale,
  generationSettings,
  onClose,
  onDeleteIndexedData,
  onChangeOcrScale,
  onChangeGenerationSetting,
  onChangeModel,
}) {
  const [isModelListOpen, setIsModelListOpen] = useState(false)
  const supportedModelIds = useMemo(
    () => Array.from(new Set(availableModelIds.filter(Boolean))),
    [availableModelIds],
  )

  /**
   * Close the model list when the user clicks outside it, otherwise close the modal.
   *
   * @returns {void}
   */
  function handleOverlayClick() {
    if (isModelListOpen) {
      setIsModelListOpen(false)
      return
    }

    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/55 px-4 py-6 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="flex w-full max-w-2xl max-h-[min(90vh,900px)] flex-col rounded-[2rem] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(28,25,23,0.22)] overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b border-stone-100 p-8 pb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
                Settings
              </p>
              <h3 className="mt-3 font-serif text-3xl leading-tight text-stone-950">
                Local processing controls
              </h3>
            </div>
            <button
              type="button"
              className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50"
              onClick={onClose}
              disabled={isDeletingIndexedData || isChangingModel}
            >
              Close
            </button>
          </div>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            Tune OCR behavior, inspect the active browser LLM, and manage locally indexed data for this site.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6">
          <OcrSettingsCard ocrScale={ocrScale} onChangeOcrScale={onChangeOcrScale} />
          <ModelSettingsCard
            currentModelId={currentModelId}
            supportedModelIds={supportedModelIds}
            generationSettings={generationSettings}
            isChangingModel={isChangingModel}
            isModelListOpen={isModelListOpen}
            onToggleModelList={() => setIsModelListOpen((isOpen) => !isOpen)}
            onCloseModelList={() => setIsModelListOpen(false)}
            onChangeGenerationSetting={onChangeGenerationSetting}
            onChangeModel={onChangeModel}
          />
          <IndexedDataDangerCard
            isDeletingIndexedData={isDeletingIndexedData}
            onDeleteIndexedData={onDeleteIndexedData}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Render OCR scale controls.
 *
 * @param {{
 *   ocrScale: number,
 *   onChangeOcrScale: (nextOcrScale: number | string) => void,
 * }} props - OCR setting value and setter.
 * @returns {JSX.Element} OCR settings card.
 */
function OcrSettingsCard({ ocrScale, onChangeOcrScale }) {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5">
      <p className="text-sm font-semibold text-stone-900">OCR Processing Scale</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">
        Higher scales improve reading of blurry or scanned text, but they also increase memory use and processing time.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_120px] md:items-center">
        <input
          type="range"
          min="0.5"
          max="5.0"
          step="0.05"
          value={ocrScale}
          onChange={(event) => onChangeOcrScale(event.target.value)}
          className="w-full accent-cyan-600"
        />
        <input
          type="number"
          min="0.5"
          max="5.0"
          step="0.05"
          value={ocrScale.toFixed(2)}
          onChange={(event) => onChangeOcrScale(event.target.value)}
          className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-cyan-400"
        />
      </div>
    </section>
  )
}

/**
 * Render current model details and a change-model chooser.
 *
 * @param {{
 *   currentModelId: string,
 *   supportedModelIds: string[],
 *   generationSettings: {
 *     temperature: number,
 *     topP: number,
 *     maxTokens: number,
 *     presencePenalty: number,
 *     frequencyPenalty: number,
 *     repetitionPenalty: number,
 *   },
 *   isChangingModel: boolean,
 *   isModelListOpen: boolean,
 *   onToggleModelList: () => void,
 *   onCloseModelList: () => void,
 *   onChangeGenerationSetting: (settingName: string, nextValue: number | string) => void,
 *   onChangeModel: (modelId: string) => Promise<void>,
 * }} props - Model UI state and actions.
 * @returns {JSX.Element} Model settings card.
 */
function ModelSettingsCard({
  currentModelId,
  supportedModelIds,
  generationSettings,
  isChangingModel,
  isModelListOpen,
  onToggleModelList,
  onCloseModelList,
  onChangeGenerationSetting,
  onChangeModel,
}) {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">Active LLM Engine</p>
          <p className="mt-2 break-all text-sm leading-6 text-stone-600">{currentModelId}</p>
        </div>

        <button
          type="button"
          className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onToggleModelList}
          disabled={isChangingModel}
        >
          {isModelListOpen ? 'Hide LLM List' : 'Change LLM'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <GenerationSettingInput
          label="Temperature"
          helperText="Controls randomness. Lower values are more deterministic."
          value={generationSettings.temperature}
          min="0"
          max="2"
          step="0.05"
          onChange={(nextValue) => onChangeGenerationSetting('temperature', nextValue)}
        />
        <GenerationSettingInput
          label="Top P"
          helperText="Nucleus sampling threshold for token selection."
          value={generationSettings.topP}
          min="0"
          max="1"
          step="0.05"
          onChange={(nextValue) => onChangeGenerationSetting('topP', nextValue)}
        />
        <GenerationSettingInput
          label="Max Tokens"
          helperText="Hard cap for the generated reply length."
          value={generationSettings.maxTokens}
          min="1"
          max="4096"
          step="1"
          onChange={(nextValue) => onChangeGenerationSetting('maxTokens', nextValue)}
        />
        <GenerationSettingInput
          label="Repetition Penalty"
          helperText="Reduces repetitive output in MLC-native decoding."
          value={generationSettings.repetitionPenalty}
          min="0.8"
          max="2.0"
          step="0.05"
          onChange={(nextValue) => onChangeGenerationSetting('repetitionPenalty', nextValue)}
        />
        <GenerationSettingInput
          label="Presence Penalty"
          helperText="Encourages the model to introduce new concepts."
          value={generationSettings.presencePenalty}
          min="-2"
          max="2"
          step="0.1"
          onChange={(nextValue) => onChangeGenerationSetting('presencePenalty', nextValue)}
        />
        <GenerationSettingInput
          label="Frequency Penalty"
          helperText="Discourages repeating the same tokens too often."
          value={generationSettings.frequencyPenalty}
          min="-2"
          max="2"
          step="0.1"
          onChange={(nextValue) => onChangeGenerationSetting('frequencyPenalty', nextValue)}
        />
      </div>

      {isModelListOpen ? (
        <div className="mt-4 space-y-3">
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {supportedModelIds.map((modelId) => (
              <button
                key={modelId}
                type="button"
                className="flex w-full items-center justify-between rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50"
                onClick={() => {
                  if (modelId === currentModelId) {
                    return
                  }

                  void onChangeModel(modelId)
                }}
                disabled={isChangingModel || modelId === currentModelId}
              >
                <span className="min-w-0 truncate text-sm font-medium text-stone-900">{modelId}</span>
                <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {modelId === currentModelId ? 'Active' : isChangingModel ? 'Loading' : 'Select'}
                </span>
              </button>
            ))}
          </div>

          <p className="rounded-[1.2rem] border border-dashed border-stone-200 px-4 py-4 text-sm text-stone-500">
            DocuHelp currently ships with the model shown here. Additional models are not enabled in this build yet.
          </p>

          <button
            type="button"
            className="rounded-full border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            onClick={onCloseModelList}
            disabled={isChangingModel}
          >
            Back
          </button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * Render one numeric generation setting input with supporting copy.
 *
 * @param {{
 *   label: string,
 *   helperText: string,
 *   value: number,
 *   min: string,
 *   max: string,
 *   step: string,
 *   onChange: (nextValue: string) => void,
 * }} props - One generation setting field.
 * @returns {JSX.Element} A labeled numeric input block.
 */
function GenerationSettingInput({ label, helperText, value, min, max, step, onChange }) {
  return (
    <label className="rounded-[1.2rem] border border-stone-200 bg-stone-50 p-4">
      <span className="text-sm font-semibold text-stone-900">{label}</span>
      <span className="mt-2 block text-sm leading-6 text-stone-500">{helperText}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-cyan-400"
      />
    </label>
  )
}

/**
 * Render the destructive indexed data section.
 *
 * @param {{
 *   isDeletingIndexedData: boolean,
 *   onDeleteIndexedData: () => Promise<void>,
 * }} props - Indexed data delete state and action.
 * @returns {JSX.Element} Indexed data action card.
 */
function IndexedDataDangerCard({ isDeletingIndexedData, onDeleteIndexedData }) {
  return (
    <section className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-5">
      <p className="text-sm font-semibold text-rose-900">Delete indexed data</p>
      <p className="mt-2 text-sm leading-6 text-rose-800/85">
        This clears all uploaded document records, chunks, and embeddings stored in IndexedDB by this site. It does not affect files outside this browser.
      </p>
      <button
        type="button"
        className="mt-4 rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
        onClick={() => {
          void onDeleteIndexedData()
        }}
        disabled={isDeletingIndexedData}
      >
        {isDeletingIndexedData ? 'Deleting...' : 'Delete all indexed data'}
      </button>
    </section>
  )
}

export default SettingsModal
