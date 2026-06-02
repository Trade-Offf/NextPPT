import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Editor from '@monaco-editor/react';
import { SLIDE_SELECTOR } from '@hds/protocol';
import { useDeckStore } from '../store/deckStore.js';

/**
 * Code mode (F-10): edits only the current slide's <section> HTML.
 * On apply, validates the markup still has a `<section class="slide">` root
 * before committing back to the store.
 *
 * The parent remounts this component (via `key={currentSlideId}`) on slide
 * switch, so the draft state initializes from the active slide directly.
 */
export function CodeEditorPane() {
  const { t } = useTranslation('editor');
  const slides = useDeckStore((s) => s.slides);
  const currentId = useDeckStore((s) => s.currentSlideId);
  const updateSlideHtml = useDeckStore((s) => s.updateSlideHtml);

  const current = slides.find((s) => s.id === currentId);
  const [draft, setDraft] = useState(current?.html ?? '');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const apply = useCallback(() => {
    if (!currentId) return;
    const doc = new DOMParser().parseFromString(draft, 'text/html');
    const sec = doc.querySelector(SLIDE_SELECTOR);
    if (!sec) {
      setError(t('code.invalid'));
      return;
    }
    updateSlideHtml(currentId, sec.outerHTML);
    setError(null);
    setDirty(false);
  }, [draft, currentId, updateSlideHtml, t]);

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--editor-bg)]">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--rule)] text-xs text-[var(--secondary-label)]">
        <span>{t('code.onlyCurrent')}</span>
        {error && <span className="text-red-500">{error}</span>}
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-amber-500">{t('code.notApplied')}</span>}
          <button
            onClick={apply}
            disabled={!dirty}
            className="hds-btn-primary px-3 py-1 text-xs disabled:opacity-40"
          >
            {t('code.apply')}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="html"
          theme="vs-dark"
          value={draft}
          onChange={(v) => { setDraft(v ?? ''); setDirty(true); }}
          options={{
            fontSize: 13,
            fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
            minimap: { enabled: false },
            wordWrap: 'on',
            tabSize: 2,
            scrollBeyondLastLine: false,
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
