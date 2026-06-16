/**
 * normalizeDeck — import-time adapter that turns already-paginated HTML written
 * in any common shape into the one structure the rest of the pipeline understands:
 * `<section class="slide">`. Once normalized, `parseDeck` / `CanvasFrame` /
 * `screenshotter` / `rebuildDeckHtml` all work unchanged.
 *
 * Scope (v1): only HTML whose pages are ALREADY discrete blocks (div.slide, bare
 * <section>, .page, [data-slide], reveal.js, equal sibling blocks). It does NOT
 * slice continuous flowing content into pages — that returns `strategy: 'none'`
 * so the caller can fall back to doc mode and nudge the user toward better prompts.
 */
import { SLIDE_SELECTOR } from '@hds/protocol';

type NormalizeStrategy =
  | 'native'
  | 'reveal'
  | 'div-slide'
  | 'slide-page'
  | 'page-class'
  | 'data-slide'
  | 'bare-section'
  | 'siblings'
  | 'none';

export interface NormalizeResult {
  /** Canonical HTML with `section.slide` pages (original string when `native`/`none`). */
  html: string;
  /** Number of detected pages. */
  slideCount: number;
  /** Which detection rule matched (`native` lets the caller skip re-serialising). */
  strategy: NormalizeStrategy;
  /**
   * How confident we are that this is a genuine 16:9 slide deck (vs. a paginated
   * document like an A4 resume). `high` may auto-open / switch to per-page; `low`
   * defaults to whole-page doc and nudges the user toward proper slide markup.
   */
  confidence: 'high' | 'low';
}

/** Strategies that are intrinsically authored as slide decks. */
const HIGH_CONFIDENCE = new Set<NormalizeStrategy>([
  'native',
  'reveal',
  'div-slide',
  'slide-page',
  'data-slide',
]);

/** Parse a CSS length token (e.g. `1280px`, `720`) into pixels; null otherwise. */
function pxValue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/.exec(raw);
  return m ? Number(m[1]) : null;
}

/**
 * Low-confidence pages can still be a real deck if the author declared a
 * landscape, ~16:9 size inline (e.g. `style="width:1280px;height:720px"` — the
 * exact shape our own prompt recommends). Promote those to high confidence.
 */
function looksLandscape(els: Element[]): boolean {
  let measured = 0;
  let landscape = 0;
  for (const el of els) {
    const he = el as HTMLElement;
    const w = pxValue(he.style?.width) ?? pxValue(el.getAttribute('width'));
    const h = pxValue(he.style?.height) ?? pxValue(el.getAttribute('height'));
    if (w == null || h == null || h === 0) continue;
    measured++;
    const ratio = w / h;
    if (w >= 960 && ratio >= 1.3 && ratio <= 2.2) landscape++;
  }
  return measured > 0 && landscape / measured >= 0.6;
}

const BLOCK_TAGS = new Set(['DIV', 'SECTION', 'ARTICLE', 'MAIN']);
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT']);

/** Keep only the outermost matches so nested hits never get wrapped twice. */
function topMost(els: Element[]): Element[] {
  const set = new Set(els);
  return els.filter((el) => {
    let p = el.parentElement;
    while (p) {
      if (set.has(p)) return false;
      p = p.parentElement;
    }
    return true;
  });
}

/** Make `el` match `section[class~="slide"]`: tag a real <section>, else wrap it. */
function ensureSlideSection(doc: Document, el: Element): void {
  if (el.tagName === 'SECTION') {
    el.classList.add('slide');
    return;
  }
  const section = doc.createElement('section');
  section.classList.add('slide');
  el.parentElement?.insertBefore(section, el);
  section.appendChild(el);
}

function serialize(doc: Document): string {
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function finalize(doc: Document, els: Element[], strategy: NormalizeStrategy): NormalizeResult {
  const pages = topMost(els);
  const confidence: 'high' | 'low' =
    HIGH_CONFIDENCE.has(strategy) || looksLandscape(pages) ? 'high' : 'low';
  for (const el of pages) ensureSlideSection(doc, el);
  return { html: serialize(doc), slideCount: pages.length, strategy, confidence };
}

function elementChildren(el: Element): Element[] {
  return Array.from(el.children).filter((c) => !SKIP_TAGS.has(c.tagName));
}

/**
 * Conservative fallback: a wrapper (body, or a lone descendant wrapper) whose
 * direct children are 2+ same-tag block containers, each with real nested
 * content. Catches "<body><div>…page…</div><div>…page…</div></body>" decks.
 * Layout sizes can't be measured at parse time, so the confirm UI guards misfires.
 */
function detectSiblings(doc: Document): Element[] | null {
  let container: Element = doc.body;
  for (let guard = 0; guard < 5; guard++) {
    const kids = elementChildren(container);
    if (kids.length === 1 && BLOCK_TAGS.has(kids[0]!.tagName)) container = kids[0]!;
    else break;
  }
  const kids = elementChildren(container);
  if (kids.length < 2) return null;
  const tag = kids[0]!.tagName;
  if (!BLOCK_TAGS.has(tag)) return null;
  if (!kids.every((k) => k.tagName === tag)) return null;
  // Each page should hold real content, not be a bare link/text row.
  if (!kids.every((k) => k.children.length > 0)) return null;
  return kids;
}

/**
 * Inspect HTML and, when it is already split into pages, return canonical
 * `section.slide` HTML plus the page count and the matched strategy.
 */
export function normalizeDeck(html: string): NormalizeResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // 0. Already canonical — leave the source byte-for-byte intact.
  const native = doc.querySelectorAll(SLIDE_SELECTOR);
  if (native.length > 0) {
    return { html, slideCount: native.length, strategy: 'native', confidence: 'high' };
  }

  // 1. reveal.js / Slidev export: `.reveal .slides > section` (top-level only).
  const reveal = Array.from(doc.querySelectorAll<HTMLElement>('.reveal .slides > section'));
  if (reveal.length > 0) return finalize(doc, reveal, 'reveal');

  // 2. Any element carrying a `slide` class token (e.g. `div.slide`).
  const dotSlide = Array.from(doc.querySelectorAll<HTMLElement>('.slide'));
  if (dotSlide.length > 0) return finalize(doc, dotSlide, 'div-slide');

  // 3a. Slide-intent page classes (authored as slides) → high confidence.
  const slidePage = Array.from(doc.querySelectorAll<HTMLElement>('.pptx-slide, .slide-page'));
  if (slidePage.length > 0) return finalize(doc, slidePage, 'slide-page');

  // 3b. Generic `.page` containers (often A4/print pages) → low confidence
  //     unless their inline size says 16:9 (handled inside `finalize`).
  const dotPage = Array.from(doc.querySelectorAll<HTMLElement>('.page'));
  if (dotPage.length > 0) return finalize(doc, dotPage, 'page-class');

  // 4. Explicit data markers.
  const dataSlide = Array.from(doc.querySelectorAll<HTMLElement>('[data-slide], [data-page]'));
  if (dataSlide.length > 0) return finalize(doc, dataSlide, 'data-slide');

  // 5. Bare top-level <section> children of <body>.
  const bareSections = Array.from(doc.body.children).filter((c) => c.tagName === 'SECTION');
  if (bareSections.length > 0) return finalize(doc, bareSections, 'bare-section');

  // 6. Equal sibling blocks heuristic (guarded by the confirm UI downstream).
  const siblings = detectSiblings(doc);
  if (siblings) return finalize(doc, siblings, 'siblings');

  // 7. No discrete pages — caller falls back to doc mode + guidance.
  return { html, slideCount: 0, strategy: 'none', confidence: 'low' };
}
