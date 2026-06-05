import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'primary' = neutral solid action, 'danger' = destructive (red). */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Minimal Linear-style confirmation dialog: left-aligned title, a quiet corner
 * close, and a single emphasised action. Reused for both the "discard changes"
 * (danger) and "save as a copy" (primary) prompts.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation('common');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="hds-modal-backdrop" onClick={onCancel}>
      <div
        className="hds-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hds-modal-header">
          <h2 className="hds-modal-heading">{title}</h2>
          <button className="hds-modal-x" onClick={onCancel} aria-label={t('close')} title={t('close')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
            </svg>
          </button>
        </div>

        <div className="hds-modal-body">
          <div className="text-[13.5px] text-[var(--secondary-label)] leading-relaxed">{message}</div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button onClick={onCancel} className="hds-dialog-btn">{cancelLabel ?? t('cancel')}</button>
            <button onClick={onConfirm} className={`hds-dialog-btn is-${tone}`}>{confirmLabel ?? t('confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
