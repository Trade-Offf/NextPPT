import { useTranslation } from 'react-i18next';

/**
 * A static DOM mock of the editor, used as the hero "product shot" (Linear-style
 * framed screenshot). Purely decorative — no real editor logic — so it stays
 * cheap and never touches the actual EditorPage.
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
          <span className="ml-3 text-[11px] text-[var(--tertiary-label)] truncate">product-launch.html — NextPPT</span>
          <span className="ml-auto text-[10px] text-[var(--tertiary-label)] font-mono">1280 × 720</span>
        </div>

        <div className="flex h-[300px] sm:h-[360px]">
          {/* Left rail: page thumbnails */}
          <div className="hidden sm:flex flex-col gap-2 w-24 shrink-0 p-3 border-r border-[var(--separator)] bg-white/[0.015]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`aspect-video rounded-md border ${i === 1 ? 'border-[var(--system-blue)]' : 'border-[var(--separator)]'} bg-white/[0.03]`}
              />
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 p-5 sm:p-7 flex items-center justify-center bg-[#0b0c0e]">
            <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-[#15161b] to-[#0e0f13] border border-[var(--separator)] p-6 sm:p-8 flex flex-col justify-center">
              <span className="text-[10px] font-mono tracking-widest uppercase text-[var(--system-blue)]">{t('preview.eyebrow')}</span>
              <h3 className="hds-preview-selected mt-2 text-lg sm:text-2xl font-bold text-[var(--label)] w-fit">
                {t('preview.heading')}
              </h3>
              <div className="mt-4 space-y-2">
                <div className="h-2 rounded-full bg-white/10 w-4/5" />
                <div className="h-2 rounded-full bg-white/10 w-3/5" />
                <div className="h-2 rounded-full bg-white/[0.07] w-2/3" />
              </div>
              <div className="mt-5 flex gap-3">
                <div className="h-14 w-28 rounded-md border border-[var(--separator)] bg-white/[0.03] grid place-items-center">
                  <span className="text-[9px] font-mono text-[var(--tertiary-label)]">mermaid</span>
                </div>
                <div className="h-14 flex-1 rounded-md border border-[var(--separator)] bg-white/[0.02]" />
              </div>
            </div>
          </div>

          {/* Right inspector */}
          <div className="hidden lg:flex flex-col gap-3 w-52 shrink-0 p-4 border-l border-[var(--separator)] bg-white/[0.015]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tertiary-label)]">{t('preview.inspectorText')}</p>
            <div className="space-y-2">
              <div className="h-7 rounded-md border border-[var(--separator)] bg-white/[0.03]" />
              <div className="flex gap-2">
                <div className="h-7 flex-1 rounded-md border border-[var(--separator)] bg-white/[0.03]" />
                <div className="h-7 w-7 rounded-md border border-[var(--system-blue)] bg-[var(--cobalt-lt)]" />
              </div>
            </div>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--tertiary-label)]">{t('preview.inspectorLayout')}</p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 rounded border border-[var(--separator)] bg-white/[0.03]" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
