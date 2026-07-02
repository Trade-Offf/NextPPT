import { useTranslation } from 'react-i18next';

/**
 * A static DOM mock of the HTML deck workbench, used as the hero "product shot"
 * (Linear-style framed screenshot). Purely decorative — no real editor logic —
 * so it stays cheap and never touches the actual HtmlWorkbenchPage.
 *
 * Reflects the HTML deck (not the PPT editor): single canvas, no thumbnail rail,
 * animated mock content on the canvas, and a "changes" panel on the right that
 * mirrors the real workbench's change-list inspector.
 */
export function EditorPreview() {
  const { t } = useTranslation('landing');
  return (
    <div className="relative w-full max-w-4xl mx-auto">
      <div className="hds-preview-glow" aria-hidden="true" />
      <div className="hds-preview-frame" aria-hidden="true">
        {/* Window chrome */}
        <div className="hds-preview-chrome">
          <span className="hds-preview-dot" style={{ background: '#ff5f57' }} />
          <span className="hds-preview-dot" style={{ background: '#febc2e' }} />
          <span className="hds-preview-dot" style={{ background: '#28c840' }} />
          <span className="ml-3 text-[11px] text-[var(--tertiary-label)] truncate">product-launch.html · NextPPT</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="hds-preview-edit-dot" />
            <span className="text-[10px] text-[var(--system-blue)] font-mono">{t('preview.editing')}</span>
          </span>
        </div>

        <div className="flex h-[300px] sm:h-[360px]">
          {/* Canvas — full-bleed HTML deck (no thumbnail rail) */}
          <div className="flex-1 relative overflow-hidden bg-[#0b0c0e]">
            {/* Animated mock content — a "live" HTML deck frame */}
            <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-center">
              <span className="hds-preview-eyebrow">{t('preview.eyebrow')}</span>
              <h3 className="hds-preview-selected mt-2 text-lg sm:text-2xl font-bold text-[var(--label)] w-fit">
                {t('preview.heading')}
              </h3>
              <div className="mt-4 space-y-2 max-w-[80%]">
                <div className="hds-preview-bar w-4/5" />
                <div className="hds-preview-bar w-3/5" />
                <div className="hds-preview-bar w-2/3 opacity-70" />
              </div>
              <div className="mt-5 flex gap-3">
                <div className="hds-preview-tile">
                  <span className="text-[9px] font-mono text-[var(--system-blue)]">{t('preview.chartLabel')}</span>
                  <div className="mt-1.5 flex items-end gap-1 h-8">
                    <div className="hds-preview-bar-v h-[40%]" />
                    <div className="hds-preview-bar-v h-[70%]" />
                    <div className="hds-preview-bar-v h-[55%]" />
                    <div className="hds-preview-bar-v h-[90%]" />
                  </div>
                </div>
                <div className="hds-preview-tile flex-1">
                  <span className="text-[9px] font-mono text-[var(--tertiary-label)]">{t('preview.mermaidLabel')}</span>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    <div className="h-1.5 rounded-full bg-white/10" />
                    <div className="h-1.5 rounded-full bg-[var(--system-blue)]/60" />
                    <div className="h-1.5 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
            {/* Live-motion sheen to suggest animation is running */}
            <div className="hds-preview-shimmer" />
          </div>

          {/* Right inspector — changes list (matches the real workbench) */}
          <div className="hidden lg:flex flex-col gap-3 w-52 shrink-0 p-4 border-l border-[var(--separator)] bg-white/[0.015]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tertiary-label)]">{t('preview.changesLabel')}</p>
            <div className="space-y-1.5">
              <div className="hds-preview-change">
                <span className="hds-preview-change-icon">✎</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 rounded-full bg-white/15 w-3/4" />
                </div>
              </div>
              <div className="hds-preview-change">
                <span className="hds-preview-change-icon">↗</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 rounded-full bg-white/15 w-1/2" />
                </div>
              </div>
              <div className="hds-preview-change">
                <span className="hds-preview-change-icon">⊕</span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 rounded-full bg-white/15 w-2/3" />
                </div>
              </div>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--tertiary-label)]">{t('preview.searchLabel')}</p>
            <div className="h-7 rounded-md border border-[var(--separator)] bg-white/[0.03] flex items-center px-2">
              <span className="text-[9px] font-mono text-[var(--tertiary-label)]">{t('preview.searchPlaceholder')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
