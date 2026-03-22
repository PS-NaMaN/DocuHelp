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
 *   onClose: () => void,
 *   onDeleteIndexedData: () => Promise<void>,
 *   onChangeOcrScale: (nextOcrScale: number | string) => void,
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
  onClose,
  onDeleteIndexedData,
  onChangeOcrScale,
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
        className="w-full max-w-2xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_30px_120px_rgba(28,25,23,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
              Settings
            </p>
            <h3 className="mt-3 font-serif text-3xl leading-tight text-stone-950">
              Local processing controls
            </h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              Tune OCR behavior, inspect the active browser LLM, and manage locally indexed data for this site.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-stone-200 px-3 py-2 text-sm font-medium text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
            onClick={onClose}
            disabled={isDeletingIndexedData || isChangingModel}
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <OcrSettingsCard ocrScale={ocrScale} onChangeOcrScale={onChangeOcrScale} />
          <ModelSettingsCard
            currentModelId={currentModelId}
            supportedModelIds={supportedModelIds}
            isChangingModel={isChangingModel}
            isModelListOpen={isModelListOpen}
            onToggleModelList={() => setIsModelListOpen((isOpen) => !isOpen)}
            onCloseModelList={() => setIsModelListOpen(false)}
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
 *   isChangingModel: boolean,
 *   isModelListOpen: boolean,
 *   onToggleModelList: () => void,
 *   onCloseModelList: () => void,
 *   onChangeModel: (modelId: string) => Promise<void>,
 * }} props - Model UI state and actions.
 * @returns {JSX.Element} Model settings card.
 */
function ModelSettingsCard({
  currentModelId,
  supportedModelIds,
  isChangingModel,
  isModelListOpen,
  onToggleModelList,
  onCloseModelList,
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
