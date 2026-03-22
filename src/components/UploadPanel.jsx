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
    <section className="rounded-[1.5rem] border border-dashed border-cyan-300 bg-cyan-50/80 p-5">
      <p className="text-sm font-semibold text-cyan-900">Upload documents</p>
      <p className="mt-2 text-sm leading-6 text-cyan-800/80">
        Accepts PDF, Markdown, and plain text. Embeddings are generated in the browser with
        `all-MiniLM-L6-v2`.
      </p>
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[1.2rem] border border-cyan-200 bg-white px-4 py-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50">
        <span className="text-sm font-medium text-stone-800">Choose one or more files</span>
        <span className="mt-2 text-xs uppercase tracking-[0.24em] text-stone-500">
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
