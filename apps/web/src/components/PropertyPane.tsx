import { useDeckStore } from '../store/deckStore.js';
import type { PatchOp } from '@hds/protocol';

interface PropertyPaneProps {
  onPatch: (selector: string, ops: PatchOp[]) => void;
}

export function PropertyPane({ onPatch }: PropertyPaneProps) {
  const selection = useDeckStore((s) => s.selection);

  if (!selection) {
    return (
      <aside className="w-[280px] shrink-0 bg-white border-l border-[var(--rule)] p-4 flex items-center justify-center">
        <p className="text-[var(--silver)] text-sm text-center">点击页面元素以编辑属性</p>
      </aside>
    );
  }

  const { selector, tagName, styleSnapshot } = selection;

  const patch = (ops: PatchOp[]) => onPatch(selector, ops);

  return (
    <aside className="w-[280px] shrink-0 bg-white border-l border-[var(--rule)] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--rule)] flex items-center gap-2">
        <code className="text-xs bg-[var(--cobalt-lt)] text-[var(--cobalt)] px-1.5 py-0.5 rounded font-mono">
          {`<${tagName}>`}
        </code>
        <span className="text-xs text-[var(--silver)] truncate">{selector}</span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* Font size */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">字号</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              defaultValue={parseFloat(styleSnapshot.fontSize)}
              step={1}
              min={8}
              max={200}
              className="w-20 border border-[var(--rule)] rounded px-2 py-1 text-sm font-mono"
              onChange={(e) =>
                patch([{ kind: 'style', name: 'font-size', value: `${e.target.value}px` }])
              }
            />
            <span className="text-xs text-[var(--silver)]">px</span>
          </div>
        </label>

        {/* Font weight */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">字重</span>
          <select
            defaultValue={
              parseInt(styleSnapshot.fontWeight) >= 700
                ? 'bold'
                : parseInt(styleSnapshot.fontWeight) <= 300
                  ? '300'
                  : 'normal'
            }
            className="border border-[var(--rule)] rounded px-2 py-1 text-sm"
            onChange={(e) => patch([{ kind: 'style', name: 'font-weight', value: e.target.value }])}
          >
            <option value="300">Light</option>
            <option value="normal">Normal</option>
            <option value="bold">Bold</option>
          </select>
        </label>

        {/* Color */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">颜色</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-8 h-8 cursor-pointer rounded border border-[var(--rule)]"
              onChange={(e) => patch([{ kind: 'style', name: 'color', value: e.target.value }])}
            />
            {/* Preset chips */}
            {['#0c1e3c', '#1d4ed8', '#475569', '#94a3b8', '#ffffff', '#ef4444', '#22c55e', '#f59e0b'].map((c) => (
              <button
                key={c}
                className="w-5 h-5 rounded-full border border-[var(--rule)] shrink-0"
                style={{ background: c }}
                onClick={() => patch([{ kind: 'style', name: 'color', value: c }])}
              />
            ))}
          </div>
        </label>

        {/* Text align */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[var(--slate)]">对齐</span>
          <div className="flex gap-1">
            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <button
                key={align}
                className="flex-1 border border-[var(--rule)] rounded py-1 text-xs hover:bg-[var(--cobalt-lt)]"
                onClick={() => patch([{ kind: 'style', name: 'text-align', value: align }])}
              >
                {align === 'left' ? '左' : align === 'center' ? '中' : align === 'right' ? '右' : '两端'}
              </button>
            ))}
          </div>
        </label>

        {/* Image src replacement (shown only for img elements) */}
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
                // Dispatches to parent via CustomEvent; parent handles file write
                const ev = new CustomEvent<{ file: File; selector: string }>('hds-replace-image', {
                  detail: { file, selector },
                  bubbles: true,
                });
                e.currentTarget.dispatchEvent(ev);
              }}
            />
          </label>
        )}
      </div>
    </aside>
  );
}
