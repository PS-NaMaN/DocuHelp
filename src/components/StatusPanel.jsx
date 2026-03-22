/**
 * Render a compact stat card used in the sidebar summary.
 *
 * @param {{ label: string, value: number }} props - Summary label and numeric value.
 * @returns {JSX.Element} A small stat card.
 */
function StatCard({ label, value }) {
  return (
    <div className="rounded-[1.2rem] border border-stone-200 bg-white px-4 py-3">
      <p className="text-[10px] uppercase font-bold tracking-widest text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  )
}

/**
 * Render the current ingestion status card.
 *
 * @param {{
 *   ingestionProgress: { stage: string, fileName: string, message: string },
 *   progressPercentage: number,
 *   storageSummary: { documentCount: number, chunkCount: number },
 *   errorMessage: string,
 * }} props - Current progress and summary values.
 * @returns {JSX.Element} The status panel.
 */
function StatusPanel({
  ingestionProgress,
  progressPercentage,
  storageSummary,
  errorMessage,
}) {
  return (
    <section className="rounded-[1.5rem] border border-stone-200 bg-stone-50/80 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-stone-900">Index status</p>
          <p className="mt-1 text-xs leading-5 text-stone-600">{ingestionProgress.message}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-white border border-stone-200 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-500">
          {ingestionProgress.stage}
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,_#0891b2,_#f97316)] transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Docs" value={storageSummary.documentCount} />
        <StatCard label="Chunks" value={storageSummary.chunkCount} />
      </div>

      {ingestionProgress.fileName ? (
        <p className="mt-4 truncate text-sm text-stone-500">
          Working on <span className="font-medium text-stone-700">{ingestionProgress.fileName}</span>
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

export default StatusPanel
