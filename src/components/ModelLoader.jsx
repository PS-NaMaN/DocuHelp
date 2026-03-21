/**
 * Render the current model-loading status for the local WebGPU engine.
 *
 * @param {{
 *   isSupported: boolean | null,
 *   isLoading: boolean,
 *   progressText: string,
 *   progressValue: number,
 *   isReady: boolean,
 *   errorMessage?: string,
 * }} props - Loader state passed from `useLocalLLM`.
 * @returns {JSX.Element} Presentational model loader status card.
 */
function ModelLoader({
  isSupported,
  isLoading,
  progressText,
  progressValue,
  isReady,
  errorMessage = '',
}) {
  if (isSupported === false) {
    return <UnsupportedModelState errorMessage={errorMessage} />
  }

  if (isLoading) {
    return (
      <LoadingModelState
        progressText={progressText}
        progressValue={progressValue}
      />
    )
  }

  if (isReady) {
    return <ReadyModelState />
  }

  return <IdleModelState />
}

/**
 * Render a browser/device compatibility fallback when WebGPU is unavailable.
 *
 * @param {{ errorMessage: string }} props - Optional compatibility error details.
 * @returns {JSX.Element} Unsupported state card.
 */
function UnsupportedModelState({ errorMessage }) {
  return (
    <section className="rounded-[1.5rem] border border-amber-300 bg-amber-50 p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
        WebGPU Required
      </p>
      <h3 className="mt-3 font-serif text-2xl text-stone-950">Local model loading is unavailable</h3>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        This feature requires a WebGPU-compatible browser and device. Try a recent version of
        Chrome, Edge, or another browser with WebGPU enabled.
      </p>
      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-800">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

/**
 * Render the active model-loading progress UI.
 *
 * @param {{ progressText: string, progressValue: number }} props - Live loading progress state.
 * @returns {JSX.Element} Loading state card.
 */
function LoadingModelState({ progressText, progressValue }) {
  return (
    <section className="rounded-[1.5rem] border border-cyan-200 bg-white/90 p-5 shadow-[0_18px_60px_rgba(8,145,178,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
            Phase 2
          </p>
          <h3 className="mt-3 font-serif text-2xl text-stone-950">Loading local language model</h3>
        </div>
        <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
          Loading
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-stone-600">{progressText}</p>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,_#0891b2,_#22c55e)] transition-all duration-500"
          style={{ width: `${progressValue}%` }}
        />
      </div>

      <p className="mt-3 text-sm font-medium text-stone-700">{progressValue}% complete</p>
    </section>
  )
}

/**
 * Render the success state shown once the model is fully initialized.
 *
 * @returns {JSX.Element} Ready state card.
 */
function ReadyModelState() {
  return (
    <section className="rounded-[1.5rem] border border-emerald-300 bg-emerald-50 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Phase 2
          </p>
          <h3 className="mt-3 font-serif text-2xl text-stone-950">Model Ready</h3>
          <p className="mt-3 text-sm leading-6 text-stone-700">
            The local WebLLM engine is initialized and ready for browser-side inference.
          </p>
        </div>
        <span className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          Ready
        </span>
      </div>
    </section>
  )
}

/**
 * Render the idle state before initialization starts.
 *
 * @returns {JSX.Element} Idle state card.
 */
function IdleModelState() {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">Phase 2</p>
      <h3 className="mt-3 font-serif text-2xl text-stone-950">Model loader idle</h3>
      <p className="mt-3 text-sm leading-6 text-stone-600">
        The local WebGPU model has not been initialized yet.
      </p>
    </section>
  )
}

export default ModelLoader
