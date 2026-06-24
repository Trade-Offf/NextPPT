/**
 * Resolves relative image/video/source URLs in HTML strings to blob: URLs
 * by reading files directly from a FileSystemDirectoryHandle.
 *
 * This sidesteps the null-origin restriction of srcdoc iframes.
 */

const blobCache = new Map<string, string>();

async function getFileFromHandle(
  dir: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<File | null> {
  const parts = relativePath.replace(/^\.?\//, '').split('/');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = dir;
  try {
    for (let i = 0; i < parts.length - 1; i++) {
      current = await current.getDirectoryHandle(parts[i]);
    }
    const fileHandle = await current.getFileHandle(parts[parts.length - 1]);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}

/** Resolve all relative asset URLs in an HTML string to blob: URLs. */
export async function resolveAssetsInHtml(
  html: string,
  dir: FileSystemDirectoryHandle,
): Promise<string> {
  // Match src="..." and url("...") patterns
  const ATTR_RE = /(?:src|href|poster)="([^"]+)"/g;
  const CSS_URL_RE = /url\(["']?([^)"']+)["']?\)/g;

  const paths = new Set<string>();

  for (const [, p] of html.matchAll(ATTR_RE)) {
    if (p && !p.startsWith('data:') && !p.startsWith('http') && !p.startsWith('//') && !p.startsWith('#')) {
      paths.add(p);
    }
  }
  for (const [, p] of html.matchAll(CSS_URL_RE)) {
    if (p && !p.startsWith('data:') && !p.startsWith('http') && !p.startsWith('//') && !p.startsWith('#')) {
      paths.add(p);
    }
  }

  // Read all files in parallel
  await Promise.all(
    Array.from(paths).map(async (rel) => {
      if (blobCache.has(rel)) return;
      const file = await getFileFromHandle(dir, rel);
      if (!file) return;
      const url = URL.createObjectURL(file);
      blobCache.set(rel, url);
    }),
  );

  // Replace occurrences in HTML
  let result = html;
  for (const [rel, blobUrl] of blobCache) {
    // Escape special regex chars in the relative path
    const escaped = rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), blobUrl);
  }
  return result;
}

/**
 * Inline-data placeholder SVG for missing images. Keeps layout stable and
 * signals to the user that the asset wasn't found, without triggering 404
 * network errors or broken-image icons that can cascade into runtime failures.
 */
const BROKEN_IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">' +
      '<rect width="200" height="150" fill="#f0f0f0" stroke="#ccc" stroke-width="1" stroke-dasharray="4 4"/>' +
      '<text x="100" y="80" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#999">' +
      'Image not found' +
      '</text></svg>',
  );

/**
 * When opening a single HTML file (no folder), relative asset URLs cannot be
 * resolved — srcdoc iframes resolve them against the parent origin, producing
 * 404s. This rewrites relative image/video `src`, `srcset`, `poster` and CSS
 * `url()` references to a placeholder so the deck still renders and the editor
 * stays responsive.
 *
 * **What is NOT touched**: `href` on `<link>`/`<a>`/`<use>` is left alone —
 * stylesheet 404s don't crash the runtime, but removing `href` would silently
 * drop all CSS and leave the deck invisible. `<script src>` is also left alone
 * (the runtime disables scripts separately).
 *
 * Implementation: DOMParser is used only to *discover* which relative URLs
 * need replacing; the actual substitution happens on the original HTML string
 * via split/join. This preserves the exact HTML structure — re-serialising the
 * whole document (outerHTML) would reorder attributes, normalise self-closing
 * tags, and potentially break `normalizeDeck`'s slide detection.
 *
 * Absolute URLs (http, data:, blob:, //, #) are left untouched.
 */
export function neutralizeRelativeAssets(html: string): string {
  const isRelative = (p: string) =>
    !p.startsWith('data:') &&
    !p.startsWith('http') &&
    !p.startsWith('//') &&
    !p.startsWith('#') &&
    !p.startsWith('blob:') &&
    !p.startsWith('mailto:') &&
    !p.startsWith('tel:');

  // Collect every relative asset URL that needs to be replaced. We then
  // substitute these exact strings in the original HTML — never reserialise.
  const toReplace: string[] = [];

  const doc = new DOMParser().parseFromString(html, 'text/html');

  // 1. img / source / video / input[type=image] — src
  doc.querySelectorAll('img[src], source[src], video[src], input[type="image"][src]').forEach((el) => {
    const val = el.getAttribute('src');
    if (val && isRelative(val.trim())) toReplace.push(val);
  });

  // 2. video — poster
  doc.querySelectorAll('video[poster]').forEach((el) => {
    const val = el.getAttribute('poster');
    if (val && isRelative(val.trim())) toReplace.push(val);
  });

  // 3. img / source — srcset (each candidate URL)
  doc.querySelectorAll('img[srcset], source[srcset]').forEach((el) => {
    const val = el.getAttribute('srcset');
    if (!val) return;
    for (const candidate of val.split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url && isRelative(url.trim())) toReplace.push(url);
    }
  });

  // Substitute collected URLs in the original string. split/join avoids any
  // regex-escaping pitfalls with file paths.
  let result = html;
  for (const url of toReplace) {
    if (!url) continue;
    result = result.split(url).join(BROKEN_IMG_PLACEHOLDER);
  }

  // NOTE: CSS url() is intentionally NOT rewritten here. url() is used for
  // background-image AND for @import url("style.css") — rewriting blindly
  // would corrupt CSS imports and silently drop all styles, leaving the deck
  // invisible. Background-image 404s are non-fatal (no onerror cascade), so
  // leaving them is the safer trade-off.

  // Neutralize JS-driven pagination CSS that hides slides when scripts are
  // disabled. Many decks use `.slide{display:none}` + `.slide.active{display:flex}`
  // toggled by a script; with scripts disabled, only the .active slide would
  // show (or none, if the script sets active). Force every slide visible.
  // Also neutralize `position:absolute;inset:0` which relies on a `.deck`
  // container that parseDeck doesn't extract — the slide would collapse to 0×0.
  result = result
    // .slide{display:none} → display:block (keep visible without scripts)
    .replace(/\.slide\s*\{[^}]*display\s*:\s*none[^}]*\}/g, (m) =>
      m.replace(/display\s*:\s*none/g, 'display:block'))
    // .slide.active{display:flex} → keep (already visible), no change needed
    // position:absolute on .slide rules → position:relative so it flows
    .replace(/(\.slide[^{]*\{[^}]*?)position\s*:\s*absolute/g, '$1position:relative')
    // inset:0 on .slide rules → remove (meaningless without .deck container)
    .replace(/(\.slide[^{]*\{[^}]*?)inset\s*:\s*0/g, '$1inset:auto');

  return result;
}

/**
 * Register a freshly written asset so that exports can map its blob: URL back to
 * the on-disk relative path. Used after replacing an image (F-08).
 */
export function registerBlobPath(relativePath: string, blobUrl: string) {
  blobCache.set(relativePath, blobUrl);
}

/** Revoke all cached blob URLs (call on directory close). */
export function revokeAssetCache() {
  for (const url of blobCache.values()) URL.revokeObjectURL(url);
  blobCache.clear();
}

/** Returns a map of blob: URL → original relative path for export */
export function getBlobToPathMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const [rel, blobUrl] of blobCache) map.set(blobUrl, rel);
  return map;
}
