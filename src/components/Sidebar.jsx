import LibraryModal from './LibraryModal'
import StatusPanel from './StatusPanel'
import UploadPanel from './UploadPanel'

/**
 * Render the branded sidebar header.
 *
 * @returns {JSX.Element} The sidebar hero section.
 */
function SidebarHero() {
  return (
    <div className="border-b border-stone-200/80 bg-[linear-gradient(135deg,_rgba(8,145,178,0.08),_rgba(251,146,60,0.14))] px-6 py-6">
      <h1 
        className="font-serif text-3xl leading-tight text-stone-950 cursor-pointer"
        title="A private, in-browser document analyzer. Files stay on-device while text, chunks, and embeddings are indexed into local storage."
      >
        DocuHelp
      </h1>
    </div>
  )
}

/**
 * Render the sidebar settings launcher.
 *
 * @param {{ onOpenSettings: () => void }} props - Settings open handler.
 * @returns {JSX.Element} The settings button.
 */
function SettingsButton({ onOpenSettings }) {
  return (
    <button
      type="button"
      className="flex w-full flex-col gap-2 rounded-[1.4rem] border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300 hover:bg-stone-50"
      onClick={onOpenSettings}
    >
      <div className="flex w-full items-center justify-between">
        <p className="text-sm font-semibold text-stone-900">Settings</p>
        <span className="rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Open
        </span>
      </div>
      <p className="text-[13px] leading-5 text-stone-500">
        Manage OCR, local models, and indexed data.
      </p>
    </button>
  )
}

/**
 * Render the left sidebar with upload, status, library, and settings controls.
 *
 * @param {{
 *   storedDocuments: Array<Record<string, unknown>>,
 *   storageSummary: { documentCount: number, chunkCount: number },
 *   ingestionProgress: { stage: string, fileName: string, message: string },
 *   progressPercentage: number,
 *   errorMessage: string,
 *   isIngestingDocuments: boolean,
 *   deletingDocumentFileName: string,
 *   onFileUpload: (event: { target: HTMLInputElement }) => Promise<void>,
 *   onDeleteDocument: (fileName: string) => Promise<void>,
 *   onOpenSettings: () => void,
 * }} props - Sidebar display and event props.
 * @returns {JSX.Element} The sidebar panel.
 */
function Sidebar({
  storedDocuments,
  storageSummary,
  ingestionProgress,
  progressPercentage,
  errorMessage,
  isIngestingDocuments,
  deletingDocumentFileName,
  onFileUpload,
  onDeleteDocument,
  onOpenSettings,
}) {
  return (
    <aside className="w-72 flex-shrink-0 flex flex-col h-full border-r border-stone-200/80 bg-white/88 shadow-[0_24px_80px_rgba(28,25,23,0.08)] backdrop-blur z-10">
      <div className="flex-1 overflow-y-auto space-y-6">
        <SidebarHero />
        <div className="space-y-6 px-6 pb-6">
          <UploadPanel
            isIngestingDocuments={isIngestingDocuments}
            onFileUpload={onFileUpload}
          />
        <StatusPanel
          ingestionProgress={ingestionProgress}
          progressPercentage={progressPercentage}
          storageSummary={storageSummary}
          errorMessage={errorMessage}
        />
        <LibraryModal
          storedDocuments={storedDocuments}
          deletingFileName={deletingDocumentFileName}
          onDeleteDocument={onDeleteDocument}
        />
          <SettingsButton onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
