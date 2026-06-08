/**
 * Export API contract – shared between web ExportClient and api export handler.
 */

export type ExportFormat = 'pptx' | 'pdf' | 'png';
export type ExportResolution = '1280x720@2x' | '1920x1080@2x' | '3840x2160@2x';
export type ExportWatermark = 'on' | 'off';
/**
 * Export pipeline to use:
 * - `deck`: screenshot each `<section class="slide">` → one image per page.
 * - `doc`: render the whole document → vector multi-page PDF (honours @page) or
 *   a single full-page PNG (smart pagination).
 */
export type ExportMode = 'deck' | 'doc';
/** "all" | "current" | comma-separated ordinals/ranges e.g. "1,3-5,8" */
export type ExportPageRange = string;

export interface ExportRequestMeta {
  title?: string;
  author?: string;
  /** Required when pageRange="current" */
  currentOrdinal?: number;
}

/**
 * Parsed from multipart form fields on the server.
 * Mirrors what ExportClient serialises on the browser side.
 */
export interface ExportOptions {
  format: ExportFormat;
  resolution: ExportResolution;
  watermark: ExportWatermark;
  pageRange: ExportPageRange;
  meta: ExportRequestMeta;
  /** Pipeline selector; defaults to `deck` for backward compatibility. */
  mode?: ExportMode;
}

// SSE events streamed back to the client

export interface ProgressEvent {
  current: number;
  total: number;
  phase: 'unpack' | 'screenshot' | 'render' | 'assemble' | 'deliver';
}

export interface DoneEvent {
  /** Temporary download URL, valid for 5 min */
  url: string;
  filename: string;
}

export interface ExportErrorEvent {
  code: string;
  message: string;
}

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

/** Derive output filename from deck title and range */
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
