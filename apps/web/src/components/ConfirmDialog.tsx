import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight confirm sheet reusing the macOS modal chrome. Used for one-off
 * confirmations such as the single-file "save as a copy" explanation.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
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
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hds-modal-titlebar">
          <button className="hds-modal-close" onClick={onCancel} aria-label={t('close')} title={t('close')}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
          <span className="hds-modal-title">{title}</span>
        </div>

        <div className="hds-modal-body">
          <div className="text-sm text-[var(--secondary-label)] leading-relaxed">{message}</div>

          <div className="mt-6 flex items-center justify-end gap-2.5">
            <button onClick={onCancel} className="hds-btn px-4 py-2 text-sm">{cancelLabel ?? t('cancel')}</button>
            <button onClick={onConfirm} className="hds-btn-primary px-4 py-2 text-sm font-medium">{confirmLabel ?? t('confirm')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
