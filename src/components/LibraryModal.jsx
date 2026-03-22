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
    <section className="rounded-[1.5rem] border border-stone-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-900">Library</p>
        <p className="text-xs uppercase tracking-[0.22em] text-stone-400">IndexedDB</p>
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
    <article className="rounded-[1.2rem] border border-stone-200 bg-stone-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-900">{storedDocument.name}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
            {storedDocument.extension} / {storedDocument.chunkCount} chunks
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-stone-500">
            {storedDocument.embeddingDimensions}d
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-white text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void onDeleteDocument(storedDocument.name)
            }}
            disabled={isDeleting}
            aria-label={`Delete ${storedDocument.name}`}
            title={`Delete ${storedDocument.name}`}
          >
            {isDeleting ? '...' : '×'}
          </button>
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
    <div className="rounded-[1.2rem] border border-dashed border-stone-200 px-4 py-5 text-sm leading-6 text-stone-500">
      No local documents yet. Upload a file to run extraction, chunking, embedding, and
      persistence entirely in the browser.
    </div>
  )
}

export default LibraryModal
