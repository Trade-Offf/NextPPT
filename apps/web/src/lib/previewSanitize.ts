/**
 * Strip every script vector from a full preview document so it can render in a
 * script-disabled (no `allow-scripts`) srcdoc iframe without the browser logging
 * "Blocked script execution in 'about:srcdoc' ..." for each one.
 *
 * Thumbnails / history previews are non-interactive static previews — they never
 * run the editor runtime — so removing scripts costs nothing visually for plain
 * HTML/CSS/SVG decks while keeping the sidebar light and out of reach of browser
 * extension content scripts. Parsing (not DOM insertion) never executes anything,
 * so this is safe.
 */
export function sanitizePreviewDoc(docHtml: string): string {
  const doc = new DOMParser().parseFromString(docHtml, 'text/html');
  doc.querySelectorAll('script').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      // Inline event handlers (onload/onerror/onclick/...) fire on their own.
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        continue;
      }
      // javascript:/vbscript: URLs in links/sources also count as script.
      if (
        (name === 'href' || name === 'src' || name === 'xlink:href') &&
        /^\s*(javascript|vbscript):/i.test(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
