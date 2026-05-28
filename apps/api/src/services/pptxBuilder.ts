import pptxgen from 'pptxgenjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { ScreenshotResult } from './screenshotter.js';

interface BuildPptxOptions {
  title: string;
  viewportWidth: number;
  viewportHeight: number;
  tmpDir: string;
}

export async function buildPptx(
  screenshots: ScreenshotResult[],
  opts: BuildPptxOptions,
): Promise<string> {
  const { title, viewportWidth, viewportHeight, tmpDir } = opts;

  const pptx = new pptxgen();
  pptx.title = title;
  pptx.subject = 'HTML Deck Studio export';

  // Slide dimensions in inches (96 dpi assumed; Widescreen 13.33×7.5 in = 1280×720@96dpi)
  const widthIn = (viewportWidth / 96).toFixed(4);
  const heightIn = (viewportHeight / 96).toFixed(4);
  pptx.defineLayout({ name: 'HDS', width: parseFloat(widthIn), height: parseFloat(heightIn) });
  pptx.layout = 'HDS';

  for (const shot of screenshots) {
    const slide = pptx.addSlide();
    const imgData = await fs.readFile(shot.filePath);
    const b64 = imgData.toString('base64');
    slide.addImage({
      data: `image/png;base64,${b64}`,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });
  }

  const outPath = path.join(tmpDir, 'output.pptx');
  await pptx.writeFile({ fileName: outPath });
  return outPath;
}
