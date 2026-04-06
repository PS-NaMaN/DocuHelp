const THEME_OPTIONS = [
  {
    id: 'light',
    label: 'Light',
    description: 'Soft neutral surfaces with a teal accent.',
  },
  {
    id: 'dark',
    label: 'Dark',
    description: 'Low-glare surfaces with the same accent system.',
  },
  {
    id: 'amoled',
    label: 'Amoled',
    description: 'True black surfaces with bright text to better suit OLED devices.',
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Pick your own background, surface, text, and accent colors.',
  },
]

const CUSTOM_THEME_FIELDS = [
  { key: 'appBg', label: 'App Background' },
  { key: 'panelBg', label: 'Sidebar Surface' },
  { key: 'panelMuted', label: 'Muted Surface' },
  { key: 'panelStrong', label: 'Strong Surface' },
  { key: 'textPrimary', label: 'Primary Text' },
  { key: 'textSecondary', label: 'Secondary Text' },
  { key: 'textMuted', label: 'Muted Text' },
  { key: 'accent', label: 'Accent' },
  { key: 'accentContrast', label: 'Accent Contrast' },
]

function SettingsModal({
  isDeletingLlmCache,
  isDeletingIndexedData,
  isChangingModel,
  currentModelId,
  availableModels,
  ocrScale,
  themeName,
  customThemeTokens,
  generationSettings,
  onClose,
  onDeleteLlmCache,
  onDeleteIndexedData,
  onChangeOcrScale,
  onChangeTheme,
  onChangeCustomThemeToken,
  onChangeGenerationSetting,
  onChangeModel,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 backdrop-blur-sm"
      style={{ background: 'rgba(15, 23, 42, 0.42)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90vh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border"
        style={{
          borderColor: 'var(--panel-border)',
          background: 'var(--panel-strong)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--panel-shadow)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex-shrink-0 border-b p-8 pb-6" style={{ borderColor: 'var(--panel-border)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-[0.24em]"
                style={{ color: 'var(--accent)' }}
              >
                Settings
              </p>
              <h3 className="mt-3 font-serif text-3xl leading-tight">Local processing controls</h3>
            </div>
            <button
              type="button"
              className="docuhelp-interactive-button rounded-full border px-4 py-2 text-sm font-semibold transition"
              style={{
                borderColor: 'var(--panel-border)',
                background: 'var(--panel-muted)',
                color: 'var(--text-secondary)',
              }}
              onClick={onClose}
              disabled={isDeletingIndexedData || isDeletingLlmCache || isChangingModel}
            >
              Close
            </button>
          </div>
          <p className="mt-4 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            Tune OCR behavior, choose a theme, customize the color tokens, select supported local models, and manage browser data stored by DocuHelp.
          </p>
        </div>

        <div className="docuhelp-scrollbar flex-1 space-y-6 overflow-y-auto p-8 pt-6">
          <ThemeSettingsCard
            themeName={themeName}
            customThemeTokens={customThemeTokens}
            onChangeTheme={onChangeTheme}
            onChangeCustomThemeToken={onChangeCustomThemeToken}
          />
          <OcrSettingsCard ocrScale={ocrScale} onChangeOcrScale={onChangeOcrScale} />
          <ModelSettingsCard
            currentModelId={currentModelId}
            availableModels={availableModels}
            generationSettings={generationSettings}
            isChangingModel={isChangingModel}
            onChangeGenerationSetting={onChangeGenerationSetting}
            onChangeModel={onChangeModel}
          />
          <LlmCacheDangerCard
            isDeletingLlmCache={isDeletingLlmCache}
            onDeleteLlmCache={onDeleteLlmCache}
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

function ThemeSettingsCard({
  themeName,
  customThemeTokens,
  onChangeTheme,
  onChangeCustomThemeToken,
}) {
  return (
    <section className="rounded-[1.5rem] border p-5" style={createCardStyle('muted')}>
      <p className="text-sm font-semibold">Theme</p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        Choose from built-in themes or switch to Custom to control your own theme tokens.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {THEME_OPTIONS.map((themeOption) => (
          <button
            key={themeOption.id}
            type="button"
            className="docuhelp-interactive-surface rounded-[1.2rem] border p-4 text-left transition"
            style={{
              borderColor: themeOption.id === themeName ? 'var(--accent)' : 'var(--panel-border)',
              background: themeOption.id === themeName ? 'var(--accent-soft)' : 'var(--panel-strong)',
            }}
            onClick={() => onChangeTheme(themeOption.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{themeOption.label}</p>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  {themeOption.description}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: themeOption.id === themeName ? 'var(--accent)' : 'var(--panel-muted)',
                  color:
                    themeOption.id === themeName
                      ? 'var(--accent-contrast)'
                      : 'var(--text-muted)',
                }}
              >
                {themeOption.id === themeName ? 'Active' : 'Select'}
              </span>
            </div>
          </button>
        ))}
      </div>

      {themeName === 'custom' ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {CUSTOM_THEME_FIELDS.map((field) => (
            <label
              key={field.key}
              className="rounded-[1.2rem] border p-4"
              style={createCardStyle('strong')}
            >
              <span className="text-sm font-semibold">{field.label}</span>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={customThemeTokens[field.key]}
                  onChange={(event) => onChangeCustomThemeToken(field.key, event.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={customThemeTokens[field.key]}
                  onChange={(event) => onChangeCustomThemeToken(field.key, event.target.value)}
                  className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
                  style={createInputStyle()}
                />
              </div>
            </label>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function OcrSettingsCard({ ocrScale, onChangeOcrScale }) {
  return (
    <section className="rounded-[1.5rem] border p-5" style={createCardStyle('muted')}>
      <p className="text-sm font-semibold">OCR Processing Scale</p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
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
          className="w-full"
          style={{ accentColor: 'var(--accent)' }}
        />
        <input
          type="number"
          min="0.5"
          max="5.0"
          step="0.05"
          value={ocrScale.toFixed(2)}
          onChange={(event) => onChangeOcrScale(event.target.value)}
          className="rounded-xl border px-4 py-3 text-sm outline-none transition"
          style={createInputStyle()}
        />
      </div>
    </section>
  )
}

function ModelSettingsCard({
  currentModelId,
  availableModels,
  generationSettings,
  isChangingModel,
  onChangeGenerationSetting,
  onChangeModel,
}) {
  const currentModelOption = availableModels.find((modelOption) => modelOption.id === currentModelId)

  return (
    <section className="rounded-[1.5rem] border p-5" style={createCardStyle('strong')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Active LLM Engine</p>
          <p className="mt-2 text-base font-semibold">
            {currentModelOption?.label ?? currentModelId}
          </p>
          <p className="mt-2 break-all text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            {currentModelId}
          </p>
          {currentModelOption?.description ? (
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
              {currentModelOption.description}
            </p>
          ) : null}
        </div>

        <span
          className="rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
          style={{
            background: isChangingModel ? 'var(--warning-soft)' : 'var(--accent-soft)',
            color: isChangingModel ? 'var(--warning-text)' : 'var(--accent)',
          }}
        >
          {isChangingModel ? 'Loading' : 'Supported'}
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {availableModels.map((modelOption) => (
          <ModelOptionCard
            key={modelOption.id}
            modelOption={modelOption}
            isActive={modelOption.id === currentModelId}
            isChangingModel={isChangingModel}
            onChangeModel={onChangeModel}
          />
        ))}
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
    </section>
  )
}

function ModelOptionCard({ modelOption, isActive, isChangingModel, onChangeModel }) {
  return (
    <button
      type="button"
      className="docuhelp-interactive-surface w-full rounded-[1.3rem] border px-4 py-4 text-left transition"
      style={{
        borderColor: isActive ? 'var(--accent)' : 'var(--panel-border)',
        background: isActive ? 'var(--accent-soft)' : 'var(--panel-muted)',
      }}
      onClick={() => {
        if (isActive) {
          return
        }

        void onChangeModel(modelOption.id)
      }}
      disabled={isChangingModel}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{modelOption.label}</p>
          <p className="mt-2 break-all text-xs uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>
            {modelOption.id}
          </p>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
            {modelOption.description}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]"
          style={{
            background: isActive ? 'var(--accent)' : 'var(--panel-strong)',
            color: isActive ? 'var(--accent-contrast)' : 'var(--text-secondary)',
          }}
        >
          {isActive ? 'Active' : isChangingModel ? 'Loading' : 'Load'}
        </span>
      </div>
    </button>
  )
}

function GenerationSettingInput({ label, helperText, value, min, max, step, onChange }) {
  return (
    <label className="rounded-[1.2rem] border p-4" style={createCardStyle('muted')}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-2 block text-sm leading-6" style={{ color: 'var(--text-muted)' }}>
        {helperText}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-xl border px-4 py-3 text-sm outline-none transition"
        style={createInputStyle()}
      />
    </label>
  )
}

function LlmCacheDangerCard({ isDeletingLlmCache, onDeleteLlmCache }) {
  return (
    <section className="rounded-[1.5rem] border p-5" style={createDangerCardStyle('warning')}>
      <p className="text-sm font-semibold" style={{ color: 'var(--warning-text)' }}>
        Delete LLM cache
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        This removes the downloaded WebLLM model files, configs, and compiled browser artifacts for the supported local models on this site. You will need to download a model again before the next chat session.
      </p>
      <button
        type="button"
        className="docuhelp-interactive-button mt-4 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
        style={{
          background: 'var(--warning-text)',
          color: 'var(--panel-strong)',
        }}
        onClick={() => {
          void onDeleteLlmCache()
        }}
        disabled={isDeletingLlmCache}
      >
        {isDeletingLlmCache ? 'Deleting...' : 'Delete LLM cache'}
      </button>
    </section>
  )
}

function IndexedDataDangerCard({ isDeletingIndexedData, onDeleteIndexedData }) {
  return (
    <section className="rounded-[1.5rem] border p-5" style={createDangerCardStyle('danger')}>
      <p className="text-sm font-semibold" style={{ color: 'var(--danger-text)' }}>
        Delete indexed data
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
        This clears all uploaded document records, chunks, and embeddings stored in IndexedDB by this site. It does not affect files outside this browser.
      </p>
      <button
        type="button"
        className="docuhelp-interactive-button mt-4 rounded-full px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45"
        style={{
          background: 'var(--danger-text)',
          color: 'var(--panel-strong)',
        }}
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

function createCardStyle(tone) {
  return {
    borderColor: 'var(--panel-border)',
    background: tone === 'strong' ? 'var(--panel-elevated)' : 'var(--panel-muted)',
  }
}

function createDangerCardStyle(tone) {
  if (tone === 'warning') {
    return {
      borderColor: 'var(--warning-soft)',
      background: 'var(--warning-soft)',
    }
  }

  return {
    borderColor: 'var(--danger-soft)',
    background: 'var(--danger-soft)',
  }
}

function createInputStyle() {
  return {
    borderColor: 'var(--panel-border)',
    background: 'var(--panel-strong)',
    color: 'var(--text-primary)',
  }
}

export default SettingsModal
