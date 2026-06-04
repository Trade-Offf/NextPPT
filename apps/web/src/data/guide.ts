/**
 * Shared identifier for the three guide steps, used as section anchors on the
 * guide page (#generate / #edit / #export) and as the optional target when
 * opening the guide from elsewhere in the app.
 *
 * The actual guide copy (prompt, steps, edit abilities, export notes) lives in
 * the i18n resources under the `guide` and `prompt` namespaces — see
 * `src/i18n/locales/*`.
 */
export type GuideTab = 'generate' | 'edit' | 'export';
