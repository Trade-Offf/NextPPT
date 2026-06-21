import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs/promises';

export interface DocRenderResult {
  filePath: string;
  ext: 'pdf' | 'png';
}

interface DocRenderOptions {
  /** 'pdf' = screenshot embedded in PDF; 'png' = full-page raster. */
  format: 'pdf' | 'png';
  /** Layout width for the document (CSS px). */
  viewportWidth: number;
  /** Supersampling factor for PNG/PDF crispness. */
  deviceScaleFactor: number;
  tmpDir: string;
  onProgress: (current: number, total: number) => void;
}

/**
 * Free-edit (doc) mode rendering.
 *
 * Both PNG and PDF use screenshot-based capture for full WYSIWYG fidelity:
 *  - PNG: `page.screenshot({ fullPage: true })` captures the full document as one
 *    tall raster image.
 *  - PDF: screenshot + pdf-lib embed (replaces the former `page.pdf()` call, which
 *    lost emoji glyphs in headless Chromium's PDF compositor). Emoji and web fonts
 *    render correctly via the browser's screen compositor before capture.
 *
 * Media emulation is always 'screen' since both outputs are raster screenshots.
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
    // Both PNG and PDF now use screenshot (PDF no longer uses page.pdf()), so
    // always emulate 'screen' media so the document renders as designed.
    await page.emulateMediaType('screen');

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
    } else {
      // PDF: screenshot the full page and embed into a PDF via pdf-lib.
      // page.pdf() relies on the browser's native PDF vector renderer, which does
      // NOT include emoji fonts in headless Chromium — emojis would render as
      // tofu (missing-glyph boxes). Screenshot-based PDF preserves emoji rendering
      // from the browser's screen compositor at full fidelity.
      const outFile = path.join(tmpDir, 'output.png');
      await page.screenshot({ path: outFile, type: 'png', fullPage: true });
      onProgress(1, 1);

      const { PDFDocument } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const imgBytes = await fs.readFile(outFile);
      const img = await pdf.embedPng(imgBytes);
      const pdfPage = pdf.addPage([img.width, img.height]);
      pdfPage.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      const pdfBytes = await pdf.save();
      const pdfOutFile = path.join(tmpDir, 'output.pdf');
      await fs.writeFile(pdfOutFile, pdfBytes);
      return { filePath: pdfOutFile, ext: 'pdf' };
    }
  } finally {
    await browser.close();
  }
}
