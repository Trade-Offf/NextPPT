import { useRef, useState } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import type { PatchOp } from '@hds/protocol';

interface PropertyPaneProps {
  onPatch: (selector: string, ops: PatchOp[]) => void;
}

const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li', 'td', 'th', 'label', 'a', 'button', 'strong', 'em', 'code', 'pre']);

export function PropertyPane({ onPatch }: PropertyPaneProps) {
  const selection = useDeckStore((s) => s.selection);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!selection) {
    return (
      <aside className="hds-panel w-[300px] shrink-0 p-4 flex items-center justify-center">
        <p className="text-[var(--tertiary-label)] text-sm text-center leading-relaxed">点击页面元素选中<br />双击文本可直接改字</p>
      </aside>
    );
  }

  const { selector, tagName, styleSnapshot, attrs } = selection;
  const isTextEl = TEXT_TAGS.has(tagName);
  const deco = styleSnapshot.textDecoration ?? '';
  const hasUnderline = deco.includes('underline');
  const hasLineThrough = deco.includes('line-through');

  const patch = (ops: PatchOp[]) => onPatch(selector, ops);

  const commitFontSize = (val: string) => {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) patch([{ kind: 'style', name: 'font-size', value: `${n}px` }]);
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

  return (
    <aside className="hds-panel w-[300px] shrink-0 overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--separator)] flex items-center gap-2">
        <code className="text-xs bg-[var(--cobalt-lt)] text-[var(--system-blue)] px-1.5 py-0.5 rounded font-mono shrink-0">
          {`<${tagName}>`}
        </code>
        <span className="text-[10px] text-[var(--tertiary-label)] truncate" title={selector}>{selector}</span>
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

        {/* ── Text decoration (F-07) ────────────────────── */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">文本装饰</span>
          <div className="flex gap-1">
            <button
              className={`flex-1 border rounded py-1 text-xs transition-colors ${hasUnderline ? 'bg-[var(--cobalt-lt)] border-[var(--cobalt)] text-[var(--cobalt)]' : 'border-[var(--rule)] hover:border-[var(--cobalt)]'}`}
              onClick={() => toggleDecoration('underline')}
            >
              <span style={{ textDecoration: 'underline' }}>下划线</span>
            </button>
            <button
              className={`flex-1 border rounded py-1 text-xs transition-colors ${hasLineThrough ? 'bg-[var(--cobalt-lt)] border-[var(--cobalt)] text-[var(--cobalt)]' : 'border-[var(--rule)] hover:border-[var(--cobalt)]'}`}
              onClick={() => toggleDecoration('line-through')}
            >
              <span style={{ textDecoration: 'line-through' }}>删除线</span>
            </button>
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

        {/* ── Image src replacement (F-08) ──────────────── */}
        {tagName === 'img' && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--slate)]">替换图片</span>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file?.type.startsWith('image/')) replaceImage(file);
              }}
              className={`rounded-lg border-2 border-dashed px-3 py-4 text-center transition-colors ${
                dragOver ? 'border-[var(--cobalt)] bg-[var(--cobalt-lt)]' : 'border-[var(--rule)]'
              }`}
            >
              <p className="text-[11px] text-[var(--silver)] mb-2">拖拽图片到此处，或</p>
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
              <label
                htmlFor="hds-img-input"
                className="inline-block cursor-pointer rounded-md bg-[var(--cobalt-lt)] px-3 py-1 text-xs text-[var(--cobalt)] hover:opacity-80"
              >
                选择文件
              </label>
            </div>
          </div>
        )}

        {/* ── Link (F-07) ───────────────────────────────── */}
        {tagName === 'a' && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--slate)]">链接地址</span>
              <input
                type="url"
                placeholder="https://…"
                defaultValue={attrs?.href ?? ''}
                className="w-full border border-[var(--rule)] rounded px-2 py-1 text-sm focus:outline-none focus:border-[var(--cobalt)]"
                onBlur={(e) => patch([{ kind: 'attr', name: 'href', value: e.target.value || null }])}
                onKeyDown={(e) => { if (e.key === 'Enter') patch([{ kind: 'attr', name: 'href', value: (e.target as HTMLInputElement).value || null }]); }}
              />
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked={attrs?.target === '_blank'}
                onChange={(e) => patch([{ kind: 'attr', name: 'target', value: e.target.checked ? '_blank' : null }])}
              />
              <span className="text-xs text-[var(--slate)]">在新标签页打开</span>
            </label>
          </div>
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
