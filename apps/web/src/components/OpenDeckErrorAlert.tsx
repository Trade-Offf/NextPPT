interface Props {
  error: string;
  className?: string;
  /** When false, omit `hds-open-error` (use if a second copy is rendered on the same page). */
  scrollAnchor?: boolean;
}

/** Shown when opening a folder/HTML file fails (missing permission, no HTML, etc.). */
export function OpenDeckErrorAlert({ error, className = '', scrollAnchor = true }: Props) {
  return (
    <div
      id={scrollAnchor ? 'hds-open-error' : undefined}
      role="alert"
      className={`hds-open-error ${className}`.trim()}
    >
      <p className="hds-open-error-text">{error}</p>
    </div>
  );
}
