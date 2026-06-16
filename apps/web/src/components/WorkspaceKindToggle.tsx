import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkspaceKind } from '@hds/protocol';
import { useDeckStore } from '../store/deckStore.js';
import { useOpenDeck } from '../fs/useOpenDeck.js';
import { useGuideNav } from '../hooks/useGuideNav.js';
import { ConfirmDialog } from './ConfirmDialog.js';

/**
 * Editor entry point to switch the open workspace between per-page (deck) and
 * whole-page (doc), seeing the effect live before editing. Switching re-derives
 * from the untouched source, so a dirty deck confirms first to avoid losing edits.
 *
 * When the source isn't a genuine 16:9 slide deck (`detectedSlideCount === 0`),
 * the per-page button doesn't silently fail — it opens guidance explaining why
 * and how to re-prompt the AI for proper `section.slide` pages.
 */
export function WorkspaceKindToggle() {
  const { t } = useTranslation('editor');
  const kind = useDeckStore((s) => s.kind);
  const detectedSlideCount = useDeckStore((s) => s.detectedSlideCount);
  const isDirty = useDeckStore((s) => s.isDirty);
  const { switchWorkspaceKind, loading } = useOpenDeck();
  const { openGuide } = useGuideNav();
  const [confirmTarget, setConfirmTarget] = useState<WorkspaceKind | null>(null);
  const [unsuitableOpen, setUnsuitableOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const deckAvailable = detectedSlideCount >= 1;

  const select = (target: WorkspaceKind) => {
    if (target === kind || loading) return;
    if (target === 'deck' && !deckAvailable) {
      setCopied(false);
      setUnsuitableOpen(true);
      return;
    }
    if (isDirty) {
      setConfirmTarget(target);
      return;
    }
    void switchWorkspaceKind(target);
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(t('deckUnsuitable.promptText'));
      setCopied(true);
    } catch {
      /* clipboard blocked — leave label unchanged */
    }
  };

  return (
    <>
      <div className="hds-segmented" role="tablist" aria-label={t('page.kindDeck') + ' / ' + t('page.kindDoc')}>
        <button
          role="tab"
          aria-selected={kind === 'deck'}
          disabled={loading}
          className={`hds-segment ${kind === 'deck' ? 'is-active' : ''} ${!deckAvailable ? 'is-muted' : ''}`}
          onClick={() => select('deck')}
          title={deckAvailable ? t('page.kindDeckTip') : t('page.kindUnavailable')}
        >
          {t('page.kindDeck')}
        </button>
        <button
          role="tab"
          aria-selected={kind === 'doc'}
          disabled={loading}
          className={`hds-segment ${kind === 'doc' ? 'is-active' : ''}`}
          onClick={() => select('doc')}
          title={t('page.kindDocTip')}
        >
          {t('page.kindDoc')}
        </button>
      </div>

      {/* Switching a dirty deck re-derives from source → confirm to avoid data loss. */}
      <ConfirmDialog
        open={confirmTarget !== null}
        title={t('switchKind.title')}
        message={t('switchKind.msg')}
        confirmLabel={confirmTarget === 'deck' ? t('switchKind.toDeck') : t('switchKind.toDoc')}
        cancelLabel={t('switchKind.keepEditing')}
        onConfirm={() => {
          const target = confirmTarget;
          setConfirmTarget(null);
          if (target) void switchWorkspaceKind(target);
        }}
        onCancel={() => setConfirmTarget(null)}
      />

      {/* Per-page unavailable: explain + offer a copy-ready re-prompt and the guide. */}
      <ConfirmDialog
        open={unsuitableOpen}
        title={t('deckUnsuitable.title')}
        confirmLabel={t('deckUnsuitable.viewGuide')}
        cancelLabel={t('deckUnsuitable.dismiss')}
        onConfirm={() => {
          setUnsuitableOpen(false);
          openGuide('generate');
        }}
        onCancel={() => setUnsuitableOpen(false)}
        message={
          <div className="space-y-3">
            <p>{t('deckUnsuitable.body')}</p>
            <p className="text-[12.5px] text-[var(--tertiary-label)]">{t('deckUnsuitable.promptHint')}</p>
            <div className="rounded-lg bg-black/20 border border-white/10 p-2.5 text-[12px] leading-relaxed text-white/80">
              {t('deckUnsuitable.promptText')}
            </div>
            <button onClick={copyPrompt} className="hds-dialog-btn">
              {copied ? t('deckUnsuitable.copied') : t('deckUnsuitable.copyPrompt')}
            </button>
          </div>
        }
      />
    </>
  );
}
