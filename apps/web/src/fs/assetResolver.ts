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
