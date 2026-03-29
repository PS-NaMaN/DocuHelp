const ACCEPTED_FILE_TYPES =
  '.pdf,.md,.markdown,.txt,text/plain,application/pdf,text/markdown'

/**
 * Render the upload control card.
 *
 * @param {{
 *   isIngestingDocuments: boolean,
 *   onFileUpload: (event: { target: HTMLInputElement }) => Promise<void>,
 * }} props - Upload state and change handler.
 * @returns {JSX.Element} The upload panel.
 */
function UploadPanel({ isIngestingDocuments, onFileUpload }) {
  return (
    <section
      className="rounded-[1.5rem] border p-5"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-elevated)',
      }}
    >
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        Upload documents
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        Accepts PDF, Markdown, and plain text. Embeddings are generated in the browser with
        `all-MiniLM-L6-v2`.
      </p>
      <label
        className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[1.2rem] border px-4 py-6 text-center transition"
        style={{
          borderColor: 'var(--panel-border)',
          background: 'var(--panel-muted)',
        }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Choose one or more files
        </span>
        <span
          className="mt-2 text-xs uppercase tracking-[0.24em]"
          style={{ color: 'var(--text-muted)' }}
        >
          PDF / MD / TXT
        </span>
        <input
          className="sr-only"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={onFileUpload}
          disabled={isIngestingDocuments}
        />
      </label>
    </section>
  )
}

export default UploadPanel
