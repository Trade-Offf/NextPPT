/**
 * Local copies of @hds/protocol runtime helpers.
 * Using local copies avoids Node.js ESM resolution issues with tsx + workspace .ts packages.
 * Types are still imported from @hds/protocol (erased at runtime).
 */

export type ExportFormat = 'pptx' | 'pdf';
export type ExportPageRange = string;

/** Parses e.g. "1,3-5,8" into sorted unique ordinals */
export function parsePageRange(range: ExportPageRange, total: number): number[] {
  if (range === 'all') return Array.from({ length: total }, (_, i) => i + 1);
  const parts = range.split(',').flatMap((part) => {
    const m = part.match(/^(\d+)-(\d+)$/);
    if (m) {
      const lo = parseInt(m[1]!, 10);
      const hi = parseInt(m[2]!, 10);
      return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    }
    return [parseInt(part, 10)];
  });
  return [...new Set(parts)]
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
}

/** Derive output filename from deck title and ordinal range */
export function exportFilename(
  title: string,
  format: ExportFormat,
  ordinals: number[],
  total: number,
): string {
  const safe = title.replace(/[^\w\u4e00-\u9fa5\- ]/g, '').trim() || 'deck';
  if (ordinals.length === total) return `${safe}.${format}`;
  if (ordinals.length === 1) return `${safe}-p${ordinals[0]}.${format}`;
  const min = ordinals[0];
  const max = ordinals[ordinals.length - 1];
  return `${safe}-p${min}-${max}.${format}`;
}

export const SLIDE_SELECTOR = 'section[class~="slide"]';
