import path from 'node:path';
import fs from 'node:fs/promises';
import type { ScreenshotResult } from './screenshotter.js';

interface BuildPdfOptions {
  title: string;
  tmpDir: string;
}

/**
 * Assembles a multi-page PDF from PNG screenshots.
 * Uses a minimal PDF writer (no external lib dependency) for maximum compatibility.
 * Each image becomes one page at its natural pixel dimensions.
 */
export async function buildPdf(
  screenshots: ScreenshotResult[],
  opts: BuildPdfOptions,
): Promise<string> {
  const { tmpDir } = opts;

  // pdf-lib is CJS and exposes named exports; there is no usable default export.
  const { PDFDocument } = await import('pdf-lib');

  const pdf = await PDFDocument.create();

  for (const shot of screenshots) {
    const imgBytes = await fs.readFile(shot.filePath);
    const img = await pdf.embedPng(imgBytes);
    const page = pdf.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }

  const bytes = await pdf.save();
  const outPath = path.join(tmpDir, 'output.pdf');
  await fs.writeFile(outPath, bytes);
  return outPath;
}
