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
  onProgress: (current: number, total: number) => void;
}

export async function screenshotSlides(
  htmlPath: string,
  opts: ScreenshotOptions,
): Promise<ScreenshotResult[]> {
  const { viewportWidth, viewportHeight, deviceScaleFactor, pageRange, onProgress } = opts;

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

    // Wait for MathJax/KaTeX/Mermaid
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        // KaTeX renders synchronously; Mermaid may be async
        if ((window as unknown as { mermaid?: { run?: () => Promise<void> } }).mermaid?.run) {
          void (window as unknown as { mermaid: { run: () => Promise<void> } }).mermaid.run().then(() => resolve());
        } else {
          resolve();
        }
      });
    });

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
      const outFile = path.join(outDir, `slide-${String(ordinal).padStart(4, '0')}.png`);

      if (el) {
        // Scroll element into view to avoid stale positioning, then screenshot the element
        await el.scrollIntoView();
        await new Promise((r) => setTimeout(r, 80)); // brief settle for animations
        await el.screenshot({ path: outFile, type: 'png' });
      } else {
        // Fallback: viewport screenshot
        await page.evaluate((idx: number) => {
          const slides = document.querySelectorAll<HTMLElement>('section[class~="slide"]');
          slides[idx]?.scrollIntoView({ behavior: 'instant' });
        }, ordinal - 1);
        await new Promise((r) => setTimeout(r, 80));
        await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width: viewportWidth, height: viewportHeight } });
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
