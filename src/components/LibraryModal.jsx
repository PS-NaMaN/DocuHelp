/**
 * Render the locally indexed library list with per-document deletion controls.
 *
 * @param {{
 *   storedDocuments: Array<{
 *     id: number,
 *     name: string,
 *     extension: string,
 *     chunkCount: number,
 *     embeddingDimensions: number,
 *   }>,
 *   deletingFileName: string,
 *   onDeleteDocument: (fileName: string) => Promise<void>,
 * }} props - Stored document data and deletion handlers.
 * @returns {JSX.Element} The library panel.
 */
function LibraryModal({ storedDocuments, deletingFileName, onDeleteDocument }) {
  return (
    <section
      className="rounded-[1.5rem] border p-5"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-elevated)',
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Library
        </p>
        <p className="text-xs uppercase tracking-[0.22em]" style={{ color: 'var(--text-muted)' }}>
          IndexedDB
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {storedDocuments.length ? (
          storedDocuments.map((storedDocument) => (
            <LibraryDocumentCard
              key={storedDocument.id}
              storedDocument={storedDocument}
              isDeleting={deletingFileName === storedDocument.name}
              onDeleteDocument={onDeleteDocument}
            />
          ))
        ) : (
          <EmptyLibraryState />
        )}
      </div>
    </section>
  )
}

/**
 * Render a single indexed document card with a delete action.
 *
 * @param {{
 *   storedDocument: {
 *     id: number,
 *     name: string,
 *     extension: string,
 *     chunkCount: number,
 *     embeddingDimensions: number,
 *   },
 *   isDeleting: boolean,
 *   onDeleteDocument: (fileName: string) => Promise<void>,
 * }} props - Indexed document metadata and delete action.
 * @returns {JSX.Element} A document card row.
 */
function LibraryDocumentCard({ storedDocument, isDeleting, onDeleteDocument }) {
  return (
    <article
      className="rounded-[1.2rem] border p-3"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-muted)',
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p
            className="line-clamp-2 flex-1 break-words text-[13px] font-medium leading-5"
            style={{ color: 'var(--text-primary)' }}
            title={storedDocument.name}
          >
            {storedDocument.name}
          </p>
          <button
            type="button"
            className="docuhelp-interactive-button flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderColor: 'var(--danger-soft)',
              background: 'var(--panel-strong)',
              color: 'var(--danger-text)',
            }}
            onClick={() => {
              void onDeleteDocument(storedDocument.name)
            }}
            disabled={isDeleting}
            aria-label={`Delete ${storedDocument.name}`}
            title={`Delete ${storedDocument.name}`}
          >
            {isDeleting ? '...' : 'x'}
          </button>
        </div>

        <div className="mt-1 flex items-center justify-between">
          <p
            className="truncate pr-2 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {storedDocument.extension} | {storedDocument.chunkCount} chunks
          </p>
          <span
            className="flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-sm"
            style={{
              borderColor: 'var(--panel-border)',
              background: 'var(--panel-strong)',
              color: 'var(--text-muted)',
            }}
          >
            {storedDocument.embeddingDimensions}d
          </span>
        </div>
      </div>
    </article>
  )
}

/**
 * Render the empty state shown before any documents have been indexed.
 *
 * @returns {JSX.Element} The empty library placeholder.
 */
function EmptyLibraryState() {
  return (
    <div
      className="rounded-[1.2rem] border px-4 py-5 text-sm leading-6"
      style={{
        borderColor: 'var(--panel-border)',
        background: 'var(--panel-muted)',
        color: 'var(--text-secondary)',
      }}
    >
      No local documents yet. Upload a file to run extraction, chunking, embedding, and
      persistence entirely in the browser.
    </div>
  )
}

export default LibraryModal
