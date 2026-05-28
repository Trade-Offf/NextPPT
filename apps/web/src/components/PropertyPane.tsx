import { useRef, useEffect } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import type { PatchOp } from '@hds/protocol';

interface PropertyPaneProps {
  onPatch: (selector: string, ops: PatchOp[]) => void;
}

const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li', 'td', 'th', 'label', 'a', 'button', 'strong', 'em', 'code', 'pre']);

export function PropertyPane({ onPatch }: PropertyPaneProps) {
  const selection = useDeckStore((s) => s.selection);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Sync textarea content when selection changes
  useEffect(() => {
    if (textAreaRef.current && selection) {
      // Content filled by caller; keep as-is
    }
  }, [selection?.selector]);

  if (!selection) {
    return (
      <aside className="w-[280px] shrink-0 bg-white border-l border-[var(--rule)] p-4 flex items-center justify-center">
        <p className="text-[var(--silver)] text-sm text-center">点击页面元素<br />选中后可编辑属性</p>
      </aside>
    );
  }

  const { selector, tagName, styleSnapshot } = selection;
  const isTextEl = TEXT_TAGS.has(tagName);

  const patch = (ops: PatchOp[]) => onPatch(selector, ops);

  const commitFontSize = (val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) patch([{ kind: 'style', name: 'font-size', value: `${n}px` }]);
  };

  return (
    <aside className="w-[280px] shrink-0 bg-white border-l border-[var(--rule)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center gap-2">
        <code className="text-xs bg-[var(--cobalt-lt)] text-[var(--cobalt)] px-1.5 py-0.5 rounded font-mono shrink-0">
          {`<${tagName}>`}
        </code>
        <span className="text-[10px] text-[var(--silver)] truncate" title={selector}>{selector}</span>
      </div>

      <div className="flex flex-col gap-4 p-4">

        {/* ── Text content ─────────────────────────────── */}
        {isTextEl && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--slate)]">文本内容</span>
            <textarea
              ref={textAreaRef}
              rows={3}
              placeholder="输入文字后按 Enter 确认，Shift+Enter 换行"
              className="w-full border border-[var(--rule)] rounded px-2 py-1.5 text-sm resize-y leading-snug focus:outline-none focus:border-[var(--cobalt)]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  patch([{ kind: 'text', value: e.currentTarget.value }]);
                  e.currentTarget.blur();
                }
              }}
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  patch([{ kind: 'text', value: e.target.value }]);
                }
              }}
            />
            <span className="text-[10px] text-[var(--silver)]">Enter 应用 · Shift+Enter 换行</span>
          </label>
        )}

        {/* ── Font size ─────────────────────────────────── */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">字号</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={Math.round(parseFloat(styleSnapshot.fontSize))}
              step={1}
              min={8}
              max={400}
              className="w-20 border border-[var(--rule)] rounded px-2 py-1 text-sm font-mono focus:outline-none focus:border-[var(--cobalt)]"
              onBlur={(e) => commitFontSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitFontSize((e.target as HTMLInputElement).value); }}
            />
            <span className="text-xs text-[var(--silver)]">px</span>
          </div>
        </label>

        {/* ── Font weight ───────────────────────────────── */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">字重</span>
          <select
            defaultValue={(() => {
              const w = parseInt(styleSnapshot.fontWeight);
              if (w >= 700) return '700';
              if (w <= 300) return '300';
              return '400';
            })()}
            className="border border-[var(--rule)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--cobalt)]"
            onChange={(e) => patch([{ kind: 'style', name: 'font-weight', value: e.target.value }])}
          >
            <option value="300">Light 300</option>
            <option value="400">Normal 400</option>
            <option value="500">Medium 500</option>
            <option value="600">SemiBold 600</option>
            <option value="700">Bold 700</option>
            <option value="800">ExtraBold 800</option>
            <option value="900">Black 900</option>
          </select>
        </label>

        {/* ── Color ────────────────────────────────────── */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--slate)]">颜色</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="color"
              className="w-8 h-8 cursor-pointer rounded border border-[var(--rule)] shrink-0"
              onChange={(e) => patch([{ kind: 'style', name: 'color', value: e.target.value }])}
            />
            {['#e6edf3', '#ffffff', '#0d1117', '#1d4ed8', '#475569', '#ef4444', '#22c55e', '#f59e0b', '#bc8cff', '#f78166'].map((c) => (
              <button
                key={c}
                title={c}
                className="w-5 h-5 rounded-full border border-[var(--rule)] shrink-0 hover:scale-110 transition-transform"
                style={{ background: c }}
                onClick={() => patch([{ kind: 'style', name: 'color', value: c }])}
              />
            ))}
          </div>
        </label>

        {/* ── Text align ────────────────────────────────── */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">对齐</span>
          <div className="flex gap-1">
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <button
                key={align}
                className="flex-1 border border-[var(--rule)] rounded py-1 text-xs hover:bg-[var(--cobalt-lt)] hover:border-[var(--cobalt)] transition-colors"
                onClick={() => patch([{ kind: 'style', name: 'text-align', value: align }])}
              >
                {align === 'left' ? '左' : align === 'center' ? '中' : align === 'right' ? '右' : '两端'}
              </button>
            ))}
          </div>
        </label>

        {/* ── Background color ──────────────────────────── */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--slate)]">背景色</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <input
              type="color"
              className="w-8 h-8 cursor-pointer rounded border border-[var(--rule)] shrink-0"
              onChange={(e) => patch([{ kind: 'style', name: 'background-color', value: e.target.value }])}
            />
            {['transparent', '#0d1117', '#161b22', '#ffffff', '#eff6ff', '#fef9c3', '#fce7f3'].map((c) => (
              <button
                key={c}
                title={c}
                className="w-5 h-5 rounded-full border border-[var(--rule)] shrink-0 hover:scale-110 transition-transform"
                style={{ background: c === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0/8px 8px' : c }}
                onClick={() => patch([{ kind: 'style', name: 'background-color', value: c === 'transparent' ? 'transparent' : c }])}
              />
            ))}
          </div>
        </label>

        {/* ── Image src replacement ─────────────────────── */}
        {tagName === 'img' && (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--slate)]">替换图片</span>
            <input
              type="file"
              accept="image/*"
              className="text-xs text-[var(--slate)] file:mr-2 file:rounded file:border-0 file:bg-[var(--cobalt-lt)] file:px-2 file:py-1 file:text-xs file:text-[var(--cobalt)] file:cursor-pointer"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const blobUrl = URL.createObjectURL(file);
                patch([{ kind: 'attr', name: 'src', value: blobUrl }]);
                // Notify parent to persist the file to disk
                window.dispatchEvent(new CustomEvent('hds-replace-image', { detail: { file, selector } }));
              }}
            />
          </label>
        )}

        {/* ── Opacity ───────────────────────────────────── */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">透明度</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              defaultValue={1}
              className="flex-1"
              onChange={(e) => patch([{ kind: 'style', name: 'opacity', value: e.target.value }])}
            />
          </div>
        </label>

      </div>
    </aside>
  );
}
