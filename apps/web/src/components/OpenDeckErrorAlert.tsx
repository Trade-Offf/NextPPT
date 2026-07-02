import { useTranslation } from 'react-i18next';

interface Props {
  error: string;
  className?: string;
  /** When false, omit `hds-open-error` (use if a second copy is rendered on the same page). */
  scrollAnchor?: boolean;
  /** Optional retry callback — shows a "Retry" button when provided. */
  onRetry?: () => void;
  /** Optional "try sample" callback — shows a low-key escape hatch when provided. */
  onSample?: () => void;
}

/** Shown when opening a folder/HTML file fails (missing permission, no HTML, etc.).
 *  Care-first: when callbacks are provided, offers a recovery path instead of
 *  just stating the failure. */
export function OpenDeckErrorAlert({
  error,
  className = '',
  scrollAnchor = true,
  onRetry,
  onSample,
}: Props) {
  const { t } = useTranslation('landing');
  return (
    <div
      id={scrollAnchor ? 'hds-open-error' : undefined}
      role="alert"
      className={`hds-open-error ${className}`.trim()}
    >
      <p className="hds-open-error-text">{error}</p>
      {(onRetry || onSample) && (
        <div className="hds-error-actions">
          {onRetry && (
            <button onClick={onRetry} className="hds-error-btn hds-error-btn-primary">
              {t('error.retry')}
            </button>
          )}
          {onSample && (
            <button onClick={onSample} className="hds-error-btn">
              {t('error.sample')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
