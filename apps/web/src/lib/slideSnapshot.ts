/**
 * Rasterise slides into static <img> thumbnails so the sidebar never has to keep
 * one live iframe per slide. Persistent per-slide iframes are what let browser
 * extensions (e.g. MetaMask) inject a content script into every frame — flooding
 * the console with "Blocked script execution in 'about:srcdoc'" (script-disabled
 * frames) or "MaxListenersExceededWarning" (script-enabled ones). A snapshot has
 * none of that: it is just a PNG data-URL.
 *
 * Capture runs in ONE short-lived off-screen iframe, reused across slides. We
 * inject the html-to-image UMD bundle *inside* that iframe and call it there:
 * html-to-image reads styles via the global `window.getComputedStyle`, so it must
 * execute in the same realm as the nodes it serialises — running it from the host
 * against an iframe's nodes silently produces blank styles.
 */
import HTML_TO_IMAGE_SRC from 'html-to-image/dist/html-to-image.js?raw';
import { sanitizePreviewDoc } from './previewSanitize.js';

const SLIDE_W = 1280;
const SLIDE_H = 720;
/** Thumbnail raster width (~2x the sidebar display width for crispness). */
const THUMB_W = 400;
const THUMB_H = Math.round((THUMB_W * SLIDE_H) / SLIDE_W);

interface HtmlToImage {
  toPng: (node: HTMLElement, options?: Record<string, unknown>) => Promise<string>;
}

export interface SnapshotTask {
  id: string;
  html: string;
}

/** Stable-ish signature so callers can skip slides whose content is unchanged. */
export function slideSignature(html: string): string {
  let h = 0;
  for (let i = 0; i < html.length; i++) h = (h * 31 + html.charCodeAt(i)) | 0;
  return `${html.length}:${h}`;
}

function buildCaptureDoc(sectionHtml: string, headHtml: string, assetsBaseUrl: string): string {
  // Mirror CanvasFrame's framing so the thumbnail matches the live canvas, then
  // strip the deck's own scripts (static preview) before injecting html-to-image.
  const base = sanitizePreviewDoc(`<!doctype html><html><head>
<meta charset="UTF-8">
<base href="${assetsBaseUrl}">
${headHtml}
<style>
  html,body{width:1280px;height:720px;overflow:hidden;margin:0;padding:0;}
  body{display:block!important;gap:0!important;padding:0!important;}
  section.slide,section[class~="slide"]{width:1280px!important;min-height:720px!important;max-height:720px!important;flex-shrink:0!important;}
</style>
</head><body>${sectionHtml}</body></html>`);
  // Inject the capturer after sanitising (sanitize would otherwise remove it).
  return base.replace(
    '</body>',
    `<script>${HTML_TO_IMAGE_SRC}${'<'}/script></body>`,
  );
}

function loadSrcdoc(iframe: HTMLIFrameElement, doc: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    iframe.addEventListener('load', finish, { once: true });
    iframe.srcdoc = doc;
    setTimeout(finish, 4000); // never hang on a broken slide
  });
}

async function settle(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) return;
  try {
    // Bounded wait: web fonts (esp. multi-MB CJK families) can take seconds to
    // download. Thumbnails are captured with skipFonts and render in the system
    // fallback anyway, so never block the whole pass on font readiness.
    const fontsReady = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    await Promise.race([
      fontsReady ?? Promise.resolve(),
      new Promise<void>((res) => setTimeout(res, 500)),
    ]);
  } catch {
    /* fonts API may be unavailable */
  }
  const imgs = Array.from(doc.images ?? []);
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener('load', () => res(), { once: true });
            img.addEventListener('error', () => res(), { once: true });
            setTimeout(res, 2500);
          }),
    ),
  );
  await new Promise<void>((res) => win.requestAnimationFrame(() => res()));
}

/**
 * Capture each task to a PNG data-URL, invoking `onThumb` as each finishes.
 * Processes sequentially through a single reused off-screen iframe. Stops early
 * when `isCancelled()` returns true (e.g. the deck changed).
 */
export async function captureSlideThumbnails(
  tasks: SnapshotTask[],
  headHtml: string,
  assetsBaseUrl: string,
  onThumb: (id: string, dataUrl: string) => void,
  isCancelled: () => boolean,
): Promise<void> {
  if (!tasks.length || typeof document === 'undefined') return;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin allow-scripts');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-99999px',
    top: '0',
    width: `${SLIDE_W}px`,
    height: `${SLIDE_H}px`,
    border: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(iframe);

  try {
    for (const task of tasks) {
      if (isCancelled()) break;
      await loadSrcdoc(iframe, buildCaptureDoc(task.html, headHtml, assetsBaseUrl));
      if (isCancelled()) break;
      await settle(iframe);
      if (isCancelled()) break;

      const win = iframe.contentWindow as (Window & { htmlToImage?: HtmlToImage }) | null;
      const body = iframe.contentDocument?.body;
      if (!win?.htmlToImage || !body) continue;

      try {
        const dataUrl = await win.htmlToImage.toPng(body, {
          width: SLIDE_W,
          height: SLIDE_H,
          canvasWidth: THUMB_W,
          canvasHeight: THUMB_H,
          backgroundColor: '#ffffff',
          cacheBust: false,
          // Don't fetch + base64-inline @font-face files (CJK families are
          // multi-MB and would be re-embedded per slide). At ~400px the system
          // fallback is indistinguishable and the pass becomes an order of
          // magnitude faster.
          skipFonts: true,
        });
        if (!isCancelled() && dataUrl.startsWith('data:image')) onThumb(task.id, dataUrl);
      } catch {
        /* one bad slide shouldn't abort the rest */
      }
    }
  } finally {
    iframe.remove();
  }
}
