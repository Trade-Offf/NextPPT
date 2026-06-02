import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../store/deckStore.js';
import type { PatchOp } from '@hds/protocol';

interface PropertyPaneProps {
  onPatch: (selector: string, ops: PatchOp[]) => void;
  /** Floating inspector variant: rounded glass card with slide-in animation. */
  floating?: boolean;
  /** When provided (floating), shows a close (×) button in the header. */
  onClose?: () => void;
}

const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li', 'td', 'th', 'label', 'a', 'button', 'strong', 'em', 'code', 'pre']);

const TEXT_COLORS = ['#e6edf3', '#ffffff', '#0d1117', '#1d4ed8', '#475569', '#ef4444', '#22c55e', '#f59e0b', '#bc8cff', '#f78166'];
const BG_COLORS = ['transparent', '#0d1117', '#161b22', '#ffffff', '#eff6ff', '#fef9c3', '#fce7f3'];

export function PropertyPane({ onPatch, floating = false, onClose }: PropertyPaneProps) {
  const { t } = useTranslation('editor');
  const selection = useDeckStore((s) => s.selection);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [opacity, setOpacity] = useState(1);
  const [textValue, setTextValue] = useState('');

  const selector = selection?.selector;
  const snapFontSize = selection?.styleSnapshot.fontSize;
  const snapText = selection?.text ?? '';

  // Re-sync local control state whenever the selected element (or its snapshot)
  // changes. Done during render via a tracked key — the React-recommended
  // alternative to a synchronous setState-in-effect.
  const syncKey = `${selector ?? ''}|${snapFontSize ?? ''}|${snapText}`;
  const [lastSyncKey, setLastSyncKey] = useState('');
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    if (snapFontSize) setFontSize(Math.round(parseFloat(snapFontSize)) || 16);
    setOpacity(1);
    setTextValue(snapText);
  }

  if (!selection) {
    return (
      <aside className={`hds-panel w-[300px] shrink-0 p-6 flex flex-col items-center justify-center gap-3 text-center ${floating ? 'hds-floating-inspector h-full' : ''}`}>
        <div className="w-12 h-12 rounded-2xl bg-[var(--control-bg)] border border-[var(--separator)] flex items-center justify-center">
          <svg className="w-6 h-6 text-[var(--tertiary-label)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
          </svg>
        </div>
        <p className="text-[var(--secondary-label)] text-sm leading-relaxed">{t('inspector.emptyTitle')}</p>
        <p className="text-[var(--tertiary-label)] text-xs leading-relaxed">{t('inspector.emptySubtitle')}</p>
      </aside>
    );
  }

  const { tagName, styleSnapshot, attrs } = selection;
  const isTextEl = TEXT_TAGS.has(tagName);
  const deco = styleSnapshot.textDecoration ?? '';
  const hasUnderline = deco.includes('underline');
  const hasLineThrough = deco.includes('line-through');

  const patch = (ops: PatchOp[]) => onPatch(selector!, ops);

  const commitFontSize = (n: number) => {
    if (!isNaN(n) && n > 0) {
      setFontSize(n);
      patch([{ kind: 'style', name: 'font-size', value: `${n}px` }]);
    }
  };

  const toggleDecoration = (token: 'underline' | 'line-through') => {
    const tokens = new Set(deco.split(' ').filter((t) => t === 'underline' || t === 'line-through'));
    if (tokens.has(token)) tokens.delete(token);
    else tokens.add(token);
    patch([{ kind: 'style', name: 'text-decoration', value: tokens.size ? Array.from(tokens).join(' ') : 'none' }]);
  };

  const replaceImage = (file: File) => {
    const blobUrl = URL.createObjectURL(file);
    patch([{ kind: 'attr', name: 'src', value: blobUrl }]);
    window.dispatchEvent(new CustomEvent('hds-replace-image', { detail: { file, blobUrl, selector } }));
  };

  const fontWeight = (() => {
    const w = parseInt(styleSnapshot.fontWeight);
    if (w >= 800) return '800';
    if (w >= 700) return '700';
    if (w >= 600) return '600';
    if (w >= 500) return '500';
    if (w <= 300) return '300';
    return '400';
  })();

  return (
    <aside className={`hds-panel w-[300px] shrink-0 overflow-y-auto flex flex-col ${floating ? 'hds-floating-inspector h-full' : ''}`}>
      {/* Header: tag chip + selector path */}
      <div className={`px-4 py-3 border-b border-[var(--separator)] flex items-center gap-2 sticky top-0 z-10 backdrop-blur ${floating ? 'bg-[rgba(28,29,33,0.82)]' : 'bg-[var(--vibrancy-panel)]'}`}>
        <code className="text-[11px] bg-[var(--cobalt-lt)] text-[var(--system-blue)] px-2 py-0.5 rounded-md font-mono font-medium shrink-0">
          {`<${tagName}>`}
        </code>
        <span className="text-[10px] text-[var(--tertiary-label)] truncate font-mono flex-1 min-w-0" title={selector}>{selector}</span>
        {floating && onClose && (
          <button
            onClick={onClose}
            aria-label={t('page.collapseInspector')}
            title={t('inspector.close')}
            className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[var(--secondary-label)] hover:bg-[var(--control-bg)] hover:text-[var(--label)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" /></svg>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 p-4">

        {/* ── Text ─────────────────────────────────────── */}
        {isTextEl && (
          <section>
            <div className="hds-inspector-label">{t('inspector.textLabel')}</div>
            <div className="hds-inspector-section">
              <div className="hds-inspector-block">
                <textarea
                  ref={textAreaRef}
                  rows={3}
                  value={textValue}
                  placeholder={t('inspector.textPlaceholder')}
                  className="hds-input leading-snug"
                  onChange={(e) => {
                    setTextValue(e.target.value);
                    patch([{ kind: 'text', value: e.target.value }]);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
                <span className="text-[10px] text-[var(--tertiary-label)]">{t('inspector.textHint')}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Layout ───────────────────────────────────── */}
        <section>
          <div className="hds-inspector-label">{t('inspector.layoutLabel')}</div>
          <div className="hds-inspector-section">
            {/* Font size */}
            <div className="hds-inspector-row">
              <span className="hds-row-label">{t('inspector.fontSize')}</span>
              <div className="hds-row-control">
                <div className="hds-stepper">
                  <button type="button" title={t('inspector.decrease')} onClick={() => commitFontSize(Math.max(8, fontSize - 1))}>−</button>
                  <input
                    type="number"
                    min={8}
                    max={400}
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value) || 0)}
                    onBlur={(e) => commitFontSize(parseFloat(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitFontSize(parseFloat((e.target as HTMLInputElement).value)); }}
                  />
                  <button type="button" title={t('inspector.increase')} onClick={() => commitFontSize(Math.min(400, fontSize + 1))}>＋</button>
                </div>
                <span className="text-[11px] text-[var(--tertiary-label)]">px</span>
              </div>
            </div>

            {/* Font weight */}
            <div className="hds-inspector-row">
              <span className="hds-row-label">{t('inspector.fontWeight')}</span>
              <div className="hds-row-control">
                <select
                  className="hds-input"
                  value={fontWeight}
                  onChange={(e) => patch([{ kind: 'style', name: 'font-weight', value: e.target.value }])}
                >
                  <option value="300">Light · 300</option>
                  <option value="400">Regular · 400</option>
                  <option value="500">Medium · 500</option>
                  <option value="600">SemiBold · 600</option>
                  <option value="700">Bold · 700</option>
                  <option value="800">Heavy · 800</option>
                  <option value="900">Black · 900</option>
                </select>
              </div>
            </div>

            {/* Align */}
            <div className="hds-inspector-block">
              <span className="hds-block-label">{t('inspector.align')}</span>
              <div className="hds-segmented is-fill">
                {([
                  ['left', 'M3 5h18M3 10h12M3 15h18M3 20h12'],
                  ['center', 'M3 5h18M6 10h12M3 15h18M6 20h12'],
                  ['right', 'M3 5h18M9 10h12M3 15h18M9 20h12'],
                  ['justify', 'M3 5h18M3 10h18M3 15h18M3 20h18'],
                ] as const).map(([align, d]) => (
                  <button
                    key={align}
                    type="button"
                    title={align}
                    className={`hds-segment is-icon ${styleSnapshot.textAlign === align ? 'is-active' : ''}`}
                    onClick={() => patch([{ kind: 'style', name: 'text-align', value: align }])}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><path d={d} /></svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Decoration */}
            <div className="hds-inspector-block">
              <span className="hds-block-label">{t('inspector.decoration')}</span>
              <div className="hds-segmented is-fill">
                <button
                  type="button"
                  className={`hds-segment ${hasUnderline ? 'is-active' : ''}`}
                  onClick={() => toggleDecoration('underline')}
                >
                  <span style={{ textDecoration: 'underline' }}>{t('inspector.underline')}</span>
                </button>
                <button
                  type="button"
                  className={`hds-segment ${hasLineThrough ? 'is-active' : ''}`}
                  onClick={() => toggleDecoration('line-through')}
                >
                  <span style={{ textDecoration: 'line-through' }}>{t('inspector.lineThrough')}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Appearance ───────────────────────────────── */}
        <section>
          <div className="hds-inspector-label">{t('inspector.appearanceLabel')}</div>
          <div className="hds-inspector-section">
            {/* Text color */}
            <div className="hds-inspector-block">
              <span className="hds-block-label">{t('inspector.textColor')}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="color"
                  className="hds-swatch-native"
                  onChange={(e) => patch([{ kind: 'style', name: 'color', value: e.target.value }])}
                />
                {TEXT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className="hds-swatch"
                    style={{ background: c }}
                    onClick={() => patch([{ kind: 'style', name: 'color', value: c }])}
                  />
                ))}
              </div>
            </div>

            {/* Background color */}
            <div className="hds-inspector-block">
              <span className="hds-block-label">{t('inspector.bgColor')}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <input
                  type="color"
                  className="hds-swatch-native"
                  onChange={(e) => patch([{ kind: 'style', name: 'background-color', value: e.target.value }])}
                />
                {BG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    className="hds-swatch"
                    style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0/8px 8px' : c }}
                    onClick={() => patch([{ kind: 'style', name: 'background-color', value: c === 'transparent' ? 'transparent' : c }])}
                  />
                ))}
              </div>
            </div>

            {/* Opacity */}
            <div className="hds-inspector-block">
              <div className="flex items-center justify-between">
                <span className="hds-block-label">{t('inspector.opacity')}</span>
                <span className="text-[11px] text-[var(--tertiary-label)] font-mono tabular-nums">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                className="w-full"
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setOpacity(v);
                  patch([{ kind: 'style', name: 'opacity', value: String(v) }]);
                }}
              />
            </div>

            {/* Image replacement (img) */}
            {tagName === 'img' && (
              <div className="hds-inspector-block">
                <span className="hds-block-label">{t('inspector.replaceImage')}</span>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file?.type.startsWith('image/')) replaceImage(file);
                  }}
                  className={`rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
                    dragOver ? 'border-[var(--system-blue)] bg-[var(--cobalt-lt)]' : 'border-[var(--separator)]'
                  }`}
                >
                  <p className="text-[11px] text-[var(--tertiary-label)] mb-2">{t('inspector.imageDropHint')}</p>
                  <input
                    id="hds-img-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) replaceImage(file);
                      e.target.value = '';
                    }}
                  />
                  <label htmlFor="hds-img-input" className="hds-btn inline-block cursor-pointer px-3 py-1 text-xs">{t('inspector.chooseFile')}</label>
                </div>
              </div>
            )}

            {/* Link (a) */}
            {tagName === 'a' && (
              <div className="hds-inspector-block">
                <span className="hds-block-label">{t('inspector.link')}</span>
                <input
                  type="url"
                  placeholder="https://…"
                  defaultValue={attrs?.href ?? ''}
                  className="hds-input"
                  onBlur={(e) => patch([{ kind: 'attr', name: 'href', value: e.target.value || null }])}
                  onKeyDown={(e) => { if (e.key === 'Enter') patch([{ kind: 'attr', name: 'href', value: (e.target as HTMLInputElement).value || null }]); }}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked={attrs?.target === '_blank'}
                    onChange={(e) => patch([{ kind: 'attr', name: 'target', value: e.target.checked ? '_blank' : null }])}
                  />
                  <span className="text-xs text-[var(--secondary-label)]">{t('inspector.openNewTab')}</span>
                </label>
              </div>
            )}
          </div>
        </section>

      </div>
    </aside>
  );
}
