import { Trans, useTranslation } from 'react-i18next';

interface Props {
  error: string;
  formatError: boolean;
  onGoToGuide: () => void;
  className?: string;
  /** When false, omit `hds-open-error` (use if a second copy is rendered on the same page). */
  scrollAnchor?: boolean;
}

const linkBtn = 'hds-open-error-link';

/** Shown when opening a folder/HTML fails — especially missing `section.slide`. */
export function OpenDeckErrorAlert({
  error,
  formatError,
  onGoToGuide,
  className = '',
  scrollAnchor = true,
}: Props) {
  const { t } = useTranslation('editor');

  return (
    <div
      id={scrollAnchor ? 'hds-open-error' : undefined}
      role="alert"
      className={`hds-open-error ${className}`.trim()}
    >
      {formatError ? (
        <p className="hds-open-error-text">
          <Trans
            t={t}
            i18nKey="open.formatBrief"
            components={{
              code: <code className="hds-open-error-code" />,
              link: <button type="button" className={linkBtn} onClick={onGoToGuide} />,
            }}
          />
        </p>
      ) : (
        <p className="hds-open-error-text">{error}</p>
      )}
    </div>
  );
}
