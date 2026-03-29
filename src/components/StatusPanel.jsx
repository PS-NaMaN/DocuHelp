/**
 * Render a compact stat card used in the sidebar summary.
 *
 * @param {{ label: string, value: number }} props - Summary label and numeric value.
 * @returns {JSX.Element} A small stat card.
 */
function StatCard({ label, value }) {
  return (
    <div
      className="rounded-[1.2rem] border px-4 py-3"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-strong)',
      }}
    >
      <p
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
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
    <section
      className="rounded-[1.5rem] border p-5"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-muted)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Index status
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: 'var(--text-secondary)' }}>
            {ingestionProgress.message}
          </p>
        </div>
        <span
          className="flex-shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            borderColor: 'var(--panel-border)',
            background: 'var(--panel-strong)',
            color: 'var(--text-muted)',
          }}
        >
          {ingestionProgress.stage}
        </span>
      </div>

      <div
        className="mt-4 h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--panel-border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${progressPercentage}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--accent-strong))',
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <StatCard label="Docs" value={storageSummary.documentCount} />
        <StatCard label="Chunks" value={storageSummary.chunkCount} />
      </div>

      {ingestionProgress.fileName ? (
        <p className="mt-4 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>
          Working on <span style={{ color: 'var(--text-primary)' }}>{ingestionProgress.fileName}</span>
        </p>
      ) : null}

      {errorMessage ? (
        <p
          className="mt-4 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: 'var(--danger-soft)',
            background: 'var(--danger-soft)',
            color: 'var(--danger-text)',
          }}
        >
          {errorMessage}
        </p>
      ) : null}
    </section>
  )
}

export default StatusPanel
