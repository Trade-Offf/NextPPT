// Rasterizes the brand SVGs (apps/web/brand/*.svg) into PNGs via headless
// Chromium (puppeteer, borrowed from apps/api). Two modes:
//   node scripts/render-brand.mjs            -> preview sheet + raw previews
//   node scripts/render-brand.mjs --emit     -> final assets into public/
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(__dirname, '..');
const BRAND = resolve(WEB, 'brand');
const PREVIEW = resolve(BRAND, 'preview');
const PUBLIC = resolve(WEB, 'public');

// Resolve puppeteer from apps/api (the only workspace that depends on it).
const require = createRequire(resolve(WEB, '../api/package.json'));
const puppeteer = require('puppeteer');

const SYSTEM_CHROME_MAC = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SYSTEM_CHROME_LINUX = '/usr/bin/google-chrome-stable';
const executablePath = existsSync(SYSTEM_CHROME_MAC)
  ? SYSTEM_CHROME_MAC
  : existsSync(SYSTEM_CHROME_LINUX)
    ? SYSTEM_CHROME_LINUX
    : undefined;

const svgCache = new Map();
async function loadSvg(name) {
  if (!svgCache.has(name)) svgCache.set(name, await readFile(resolve(BRAND, name), 'utf8'));
  return svgCache.get(name);
}

/** Force the SVG root to an exact pixel size so it renders crisp at `size`. */
function sizeSvg(svg, w, h) {
  return svg.replace(/<svg\b[^>]*>/, (tag) => {
    let t = tag
      .replace(/\swidth="[^"]*"/, '')
      .replace(/\sheight="[^"]*"/, '');
    return t.replace('<svg', `<svg width="${w}" height="${h}"`);
  });
}

async function renderSvg(page, svg, w, h, { opaque } = {}) {
  const html = `<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;padding:0;background:transparent}</style></head>
    <body>${sizeSvg(svg, w, h)}</body></html>`;
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  return page.screenshot({ type: 'png', omitBackground: !opaque, clip: { x: 0, y: 0, width: w, height: h } });
}

/** Wrap a 32x32 (or NxN) PNG buffer in a single-image .ico container. */
function pngToIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(6 + 16, 12);
  return Buffer.concat([header, entry, png]);
}

async function emitAssets(page) {
  const icon = await loadSvg('icon.svg');
  const iconDark = await loadSvg('icon-dark.svg');
  const maskable = await loadSvg('icon-maskable.svg');

  const png = (svg, n, o) => renderSvg(page, svg, n, n, o);

  // Use dark-tile icon for favicon — stays visible in light browser chrome.
  const fav16 = await png(iconDark, 16, { opaque: true });
  const fav32 = await png(iconDark, 32, { opaque: true });
  await writeFile(resolve(PUBLIC, 'favicon-16.png'), fav16);
  await writeFile(resolve(PUBLIC, 'favicon-32.png'), fav32);
  await writeFile(resolve(PUBLIC, 'favicon.ico'), pngToIco(fav32, 32));
  // apple-touch must be opaque (iOS fills transparent corners with black).
  await writeFile(resolve(PUBLIC, 'apple-touch-icon.png'), await png(maskable, 180, { opaque: true }));
  await writeFile(resolve(PUBLIC, 'icon-192.png'), await png(icon, 192));
  await writeFile(resolve(PUBLIC, 'icon-512.png'), await png(icon, 512));
  await writeFile(resolve(PUBLIC, 'maskable-512.png'), await png(maskable, 512, { opaque: true }));
  // Header/footer emblem (kept as brand-n.png so existing code keeps working).
  await writeFile(resolve(PUBLIC, 'brand-n.png'), await png(await loadSvg('icon-dark.svg'), 256));

  await writeFile(resolve(PUBLIC, 'og-image.png'), await buildOg(page));

  console.log('Emitted public assets: favicon-16/32, favicon.ico, apple-touch-icon, icon-192/512, maskable-512, brand-n, og-image');
}

async function buildOg(page) {
  const iconDark = `data:image/png;base64,${(await renderSvg(page, await loadSvg('icon-dark.svg'), 256, 256)).toString('base64')}`;
  const W = 1200;
  const H = 630;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:-apple-system,Inter,"PingFang SC","Microsoft YaHei",Arial,sans-serif}
    body{width:${W}px;height:${H}px;overflow:hidden;
      background:radial-gradient(900px 500px at 78% 18%, rgba(94,106,210,0.20), transparent 60%),#0b0b0e;color:#f4f4f6;
      display:flex;align-items:center;gap:60px;padding:0 84px}
    .left{flex:0 0 auto;max-width:560px}
    .brandrow{display:flex;align-items:center;gap:22px}
    .brandrow img{width:104px;height:104px}
    .wm{font-size:64px;font-weight:800;letter-spacing:-0.02em}
    .tag{margin-top:34px;font-size:30px;font-weight:600;color:#e7e7ea;line-height:1.35}
    .sub{margin-top:16px;font-size:18px;color:#9a9aa2;line-height:1.5}
    .shot{flex:1 1 auto;height:380px;border-radius:18px;border:1px solid #24262d;
      background:linear-gradient(180deg,#16171c,#0f1014);box-shadow:0 30px 90px rgba(0,0,0,0.5);overflow:hidden}
    .bar{height:38px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #24262d}
    .dot{width:11px;height:11px;border-radius:50%}
    .body{padding:26px}
    .sel{height:30px;border-radius:8px;background:rgba(94,106,210,0.22);border:1.5px solid #5E6AD2;width:74%}
    .ln{height:14px;border-radius:7px;background:#23252c;margin-top:16px}
    .chip{margin-top:22px;width:120px;height:74px;border-radius:10px;background:rgba(94,106,210,0.16);border:1px solid #2c2f3a}
  </style></head><body>
    <div class="left">
      <div class="brandrow"><img src="${iconDark}"><span class="wm">NextPPT</span></div>
      <div class="tag">下一代 PPT，从 HTML 开始</div>
      <div class="sub">点一下就能改字换图，一键导出能投影的 PPT / PDF</div>
    </div>
    <div class="shot">
      <div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span><span class="dot" style="background:#28c840"></span></div>
      <div class="body">
        <div class="sel"></div>
        <div class="ln" style="width:88%"></div>
        <div class="ln" style="width:80%"></div>
        <div class="ln" style="width:64%"></div>
        <div class="chip"></div>
      </div>
    </div>
  </body></html>`;
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'load' });
  return page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });
}

async function emitPreview(page) {
  await mkdir(PREVIEW, { recursive: true });
  const dataUri = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

  const iconLight = dataUri(await renderSvg(page, await loadSvg('icon.svg'), 256, 256));
  const iconDark = dataUri(await renderSvg(page, await loadSvg('icon-dark.svg'), 256, 256));
  const maskable = dataUri(await renderSvg(page, await loadSvg('icon-maskable.svg'), 512, 512, { opaque: true }));
  const lockL = dataUri(await renderSvg(page, await loadSvg('lockup-light.svg'), 1440, 480, { opaque: true }));
  const lockD = dataUri(await renderSvg(page, await loadSvg('lockup-dark.svg'), 1440, 480, { opaque: true }));

  const sizes = [96, 48, 32, 28, 16];
  const tiles = (uri) =>
    sizes.map((s) => `<div class="t"><img src="${uri}" width="${s}" height="${s}"><span>${s}px</span></div>`).join('');

  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;box-sizing:border-box;font-family:-apple-system,Inter,Arial,sans-serif}
    body{width:1200px;background:#0b0b0e;color:#e7e7ea;padding:40px}
    h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#8a8a92;margin:34px 0 16px}
    h2:first-child{margin-top:0}
    .row{display:flex;align-items:flex-end;gap:28px}
    .t{display:flex;flex-direction:column;align-items:center;gap:8px}
    .t span{font-size:11px;color:#8a8a92}
    .panel{border-radius:16px;padding:28px;display:inline-block}
    .dark{background:#0e0f12;border:1px solid #1d1f24}
    .light{background:#ffffff}
    .lock{display:block;width:600px;border-radius:16px;margin-top:6px}
    .cap{font-size:12px;color:#8a8a92;margin-top:18px}
  </style></head><body>
    <h2>Icon on dark — dark tile (header use)</h2>
    <div class="panel dark"><div class="row">${tiles(iconDark)}</div></div>
    <h2>Icon on dark — light tile</h2>
    <div class="panel dark"><div class="row">${tiles(iconLight)}</div></div>
    <h2>Icon on light — light tile (app / favicon canonical)</h2>
    <div class="panel light"><div class="row">${tiles(iconLight)}</div></div>
    <h2>Lockup</h2>
    <img class="lock" src="${lockD}"><img class="lock" src="${lockL}">
    <h2>Maskable (safe zone)</h2>
    <div class="panel dark"><img src="${maskable}" width="180" height="180" style="border-radius:50%"> <img src="${maskable}" width="180" height="180" style="border-radius:24px"></div>
    <p class="cap">Maskable shown circle-cropped and squircle-cropped to verify the safe zone.</p>
  </body></html>`;

  await page.setViewport({ width: 1200, height: 1400, deviceScaleFactor: 2 });
  await page.setContent(sheet, { waitUntil: 'load' });
  const h = await page.evaluate(() => document.body.scrollHeight);
  await writeFile(
    resolve(PREVIEW, 'brand-sheet.png'),
    await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: h }, omitBackground: false }),
  );
  await writeFile(resolve(PREVIEW, 'lockup-dark.png'), await renderSvg(page, await loadSvg('lockup-dark.svg'), 1440, 480, { opaque: true }));
  await writeFile(resolve(PREVIEW, 'lockup-light.png'), await renderSvg(page, await loadSvg('lockup-light.svg'), 1440, 480, { opaque: true }));

  console.log(`Preview written to ${PREVIEW}/brand-sheet.png`);
}

async function main() {
  const emit = process.argv.includes('--emit');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    if (emit) await emitAssets(page);
    else await emitPreview(page);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
