import puppeteer from 'puppeteer';
import { parsePageRange, SLIDE_SELECTOR } from '../lib/protocol.js';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface ScreenshotResult {
  ordinal: number;
  filePath: string;
  width: number;
  height: number;
}

interface ScreenshotOptions {
  viewportWidth: number;
  viewportHeight: number;
  deviceScaleFactor: number;
  pageRange: string;
  /** Capture format. JPEG yields much smaller files (lighter downloads). Default 'png'. */
  imageType?: 'png' | 'jpeg';
  /** JPEG quality 1–100 (ignored for png). Default 90. */
  imageQuality?: number;
  onProgress: (current: number, total: number) => void;
}

export async function screenshotSlides(
  htmlPath: string,
  opts: ScreenshotOptions,
): Promise<ScreenshotResult[]> {
  const { viewportWidth, viewportHeight, deviceScaleFactor, pageRange, onProgress } = opts;
  const imageType: 'png' | 'jpeg' = opts.imageType === 'jpeg' ? 'jpeg' : 'png';
  const imageQuality = Math.min(100, Math.max(1, opts.imageQuality ?? 90));
  const fileExt = imageType === 'jpeg' ? 'jpg' : 'png';

  // Prefer system Chrome to avoid puppeteer cache path issues.
  // Falls back to puppeteer's bundled chrome if system Chrome not found.
  const SYSTEM_CHROME_MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const SYSTEM_CHROME_LINUX = '/usr/bin/google-chrome-stable';
  const { existsSync } = await import('node:fs');
  const executablePath =
    existsSync(SYSTEM_CHROME_MAC) ? SYSTEM_CHROME_MAC :
    existsSync(SYSTEM_CHROME_LINUX) ? SYSTEM_CHROME_LINUX :
    undefined; // let puppeteer auto-detect

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });

  try {
    const page = await browser.newPage();

    // tsx/esbuild wraps named functions with a `__name(...)` helper. When our
    // page.evaluate callbacks are serialized and run in the browser, that helper
    // is undefined → "ReferenceError: __name is not defined". Define a no-op in
    // every document (string form bypasses esbuild compilation) so evaluates work.
    await page.evaluateOnNewDocument('globalThis.__name = globalThis.__name || ((fn) => fn);');

    await page.setViewport({ width: viewportWidth, height: viewportHeight, deviceScaleFactor });

    const fileUrl = `file://${htmlPath}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

    // Freeze animations and hide browser-injected media controls for clean screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
        }
        ::-webkit-media-controls { display: none !important; }
        video::-webkit-media-controls { display: none !important; }
      `,
    });

    // ── Mermaid bootstrap (TRD §6.5.3) ──────────────────────────────────────
    // The deck may contain raw Mermaid source that was never rendered to SVG
    // (e.g. authored by an AI tool). Render any unrendered nodes here.
    await page.evaluate(async () => {
      interface MermaidApi {
        initialize: (cfg: Record<string, unknown>) => void;
        run: (opts: { nodes: Element[] }) => Promise<void>;
      }
      const w = window as unknown as { mermaid?: MermaidApi };
      const SEL =
        'pre.mermaid:not([data-mermaid-rendered]):not([data-mermaid-error]),' +
        'div.mermaid:not([data-mermaid-rendered]):not([data-mermaid-error]),' +
        '[data-mermaid]:not([data-mermaid-rendered]):not([data-mermaid-error])';
      const nodes = Array.from(document.querySelectorAll<HTMLElement>(SEL));
      if (!nodes.length) return;

      try {
        if (!w.mermaid) {
          // Non-literal URL so the bundler/TS treats this as a runtime import.
          const cdn = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
          const mod = await import(/* @vite-ignore */ cdn);
          const api = mod.default as MermaidApi;
          api.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
          w.mermaid = api;
        }
        await w.mermaid!.run({ nodes });
        nodes.forEach((n) => n.setAttribute('data-mermaid-rendered', 'true'));
      } catch (err) {
        nodes.forEach((n) => n.setAttribute('data-mermaid-error', String(err)));
      }
    });

    // Wait until every Mermaid node is either rendered or marked errored.
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const deadline = Date.now() + 8000;
        const check = () => {
          const all = document.querySelectorAll('pre.mermaid, div.mermaid, [data-mermaid]');
          const done = Array.from(all).every(
            (el) => el.hasAttribute('data-mermaid-rendered') || el.hasAttribute('data-mermaid-error'),
          );
          if (done || Date.now() > deadline) resolve();
          else requestAnimationFrame(check);
        };
        check();
      });
    });

    // Wait for web fonts (KaTeX/Google Fonts) to settle before capture.
    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    // Get all slide elements by index (more reliable than nth-child selectors)
    const allSlideHandles = await page.$$(SLIDE_SELECTOR);
    const totalSlides = allSlideHandles.length;

    const ordinals = parsePageRange(pageRange, totalSlides);
    onProgress(0, ordinals.length);

    const outDir = path.dirname(htmlPath);
    const results: ScreenshotResult[] = [];

    for (let i = 0; i < ordinals.length; i++) {
      const ordinal = ordinals[i]!;
      const el = allSlideHandles[ordinal - 1];
      const outFile = path.join(outDir, `slide-${String(ordinal).padStart(4, '0')}.${fileExt}`);
      const shotOpts =
        imageType === 'jpeg'
          ? ({ path: outFile, type: 'jpeg' as const, quality: imageQuality })
          : ({ path: outFile, type: 'png' as const });

      if (el) {
        // Scroll element into view to avoid stale positioning, then screenshot the element
        await el.scrollIntoView();
        await new Promise((r) => setTimeout(r, 80)); // brief settle for animations
        await el.screenshot(shotOpts);
      } else {
        // Fallback: viewport screenshot
        await page.evaluate((idx: number) => {
          const slides = document.querySelectorAll<HTMLElement>('section[class~="slide"]');
          slides[idx]?.scrollIntoView({ behavior: 'instant' });
        }, ordinal - 1);
        await new Promise((r) => setTimeout(r, 80));
        await page.screenshot({ ...shotOpts, clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight } });
      }

      results.push({ ordinal, filePath: outFile, width: viewportWidth * deviceScaleFactor, height: viewportHeight * deviceScaleFactor });
      onProgress(i + 1, ordinals.length);
    }

    await page.close();
    return results;
  } finally {
    await browser.close();
  }
}
