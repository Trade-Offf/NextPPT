import puppeteer from 'puppeteer';
import path from 'node:path';

export interface DocRenderResult {
  filePath: string;
  ext: 'pdf' | 'png';
}

interface DocRenderOptions {
  /** 'pdf' = vector, smart-paginated; 'png' = single full-page raster. */
  format: 'pdf' | 'png';
  /** Layout width for the document (CSS px). */
  viewportWidth: number;
  /** Supersampling factor for PNG crispness (ignored for vector PDF). */
  deviceScaleFactor: number;
  tmpDir: string;
  onProgress: (current: number, total: number) => void;
}

/**
 * Free-edit (doc) mode rendering.
 *
 * Unlike the deck pipeline (one screenshot per `section.slide`), a document is
 * rendered as a whole and paginated by the browser itself:
 *  - PDF: `page.pdf({ preferCSSPageSize: true })` produces a selectable, vector,
 *    multi-page PDF that honours the document's own `@page` size / page-break
 *    rules — true smart pagination, no rasterisation.
 *  - PNG: `page.screenshot({ fullPage: true })` captures the entire document as
 *    one tall image.
 *
 * Media emulation differs by format:
 *  - PDF uses `print` media — a PDF is a print artifact, so the document's own
 *    `@page` margins and `@media print` rules must drive pagination. Emulating
 *    `screen` here double-counts spacing for print-designed docs (e.g. a Kami A4
 *    resume that puts page padding under `@media screen` AND margins under
 *    `@page`), which silently pushes content onto an extra page.
 *  - PNG uses `screen` media — it is a WYSIWYG raster of the edited screen view.
 */
export async function renderDocument(
  htmlPath: string,
  opts: DocRenderOptions,
): Promise<DocRenderResult> {
  const { format, viewportWidth, deviceScaleFactor, tmpDir, onProgress } = opts;

  const SYSTEM_CHROME_MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const SYSTEM_CHROME_LINUX = '/usr/bin/google-chrome-stable';
  const { existsSync } = await import('node:fs');
  const executablePath =
    existsSync(SYSTEM_CHROME_MAC) ? SYSTEM_CHROME_MAC :
    existsSync(SYSTEM_CHROME_LINUX) ? SYSTEM_CHROME_LINUX :
    undefined;

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
    await page.evaluateOnNewDocument('globalThis.__name = globalThis.__name || ((fn) => fn);');
    await page.setViewport({ width: viewportWidth, height: 900, deviceScaleFactor });
    // PDF → print media (honours @page / @media print); PNG → screen (WYSIWYG raster).
    await page.emulateMediaType(format === 'pdf' ? 'print' : 'screen');

    const fileUrl = `file://${htmlPath}`;
    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 60_000 });

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

    // Mermaid bootstrap (same approach as the deck screenshotter).
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

    await page.evaluate(() => document.fonts.ready.then(() => undefined));

    onProgress(0, 1);

    if (format === 'png') {
      const outFile = path.join(tmpDir, 'output.png');
      await page.screenshot({ path: outFile, type: 'png', fullPage: true });
      onProgress(1, 1);
      return { filePath: outFile, ext: 'png' };
    }

    const outFile = path.join(tmpDir, 'output.pdf');
    await page.pdf({
      path: outFile,
      printBackground: true,
      preferCSSPageSize: true,
      format: 'A4',
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    onProgress(1, 1);
    return { filePath: outFile, ext: 'pdf' };
  } finally {
    await browser.close();
  }
}
