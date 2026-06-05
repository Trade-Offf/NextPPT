#!/usr/bin/env node
/**
 * Post-deploy smoke test for the static site.
 *
 * Catches the most common production failure: missing hashed /assets/*.js
 * returning index.html (SPA fallback) with a 200 — the browser then throws
 * "Expected JavaScript but got text/html" and the app white-screens.
 *
 * Usage:
 *   pnpm --filter @hds/web verify-deploy
 *   DEPLOY_DOMAIN=https://next-ppt.com pnpm --filter @hds/web verify-deploy
 */

const DOMAIN = (process.env.DEPLOY_DOMAIN ?? 'https://next-ppt.com').replace(/\/$/, '');
const BOGUS_ASSET = `/assets/__deploy_verify_missing__${Date.now()}.js`;

const JS_TYPES = new Set([
  'application/javascript',
  'application/x-javascript',
  'text/javascript',
]);

/** @param {string} path */
function url(path) {
  return `${DOMAIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/** @param {Response} res */
function header(res, name) {
  return res.headers.get(name) ?? '';
}

/** @param {string} label @param {boolean} ok @param {string} detail */
function line(label, ok, detail) {
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** @param {string} msg */
function fail(msg) {
  console.error(`\nFAIL: ${msg}`);
  process.exit(1);
}

/** @param {string} path @param {number} [attempts] */
async function head(path, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url(path), { method: 'HEAD', redirect: 'follow' });
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

async function main() {
  console.log(`Verifying deploy: ${DOMAIN}\n`);

  /** @param {string} path @param {RequestInit} [init] */
  async function fetchRetry(path, init) {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        return await fetch(url(path), { redirect: 'follow', ...init });
      } catch (err) {
        lastErr = err;
        if (i < 2) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw lastErr;
  }

  // ── 1. Homepage ─────────────────────────────────────────────────────────
  let indexRes;
  try {
    indexRes = await fetchRetry('/');
  } catch (err) {
    fail(`Could not reach ${DOMAIN}/ — ${err instanceof Error ? err.message : err}`);
  }

  const indexOk = indexRes.ok && header(indexRes, 'content-type').includes('text/html');
  line('GET /', indexOk, `${indexRes.status} ${header(indexRes, 'content-type')}`);
  if (!indexOk) fail('Homepage did not return HTML 200.');

  const html = await indexRes.text();
  const assetMatch = html.match(/\/assets\/app-[A-Za-z0-9_-]+\.js/);
  if (!assetMatch) fail('Could not find /assets/app-*.js in homepage HTML — build output may be wrong.');
  const assetPath = assetMatch[0];
  line('index references hashed bundle', true, assetPath);

  // ── 2. Real JS bundle ───────────────────────────────────────────────────
  const assetRes = await head(assetPath);
  const assetType = header(assetRes, 'content-type').split(';')[0].trim().toLowerCase();
  const assetJs = assetRes.ok && JS_TYPES.has(assetType);
  line('GET hashed bundle', assetJs, `${assetRes.status} ${header(assetRes, 'content-type')}`);
  if (!assetJs) fail(`Real bundle must return JavaScript, got ${assetRes.status} ${assetType}.`);

  // ── 3. Missing bundle must NOT be HTML ───────────────────────────────────
  const bogusRes = await head(BOGUS_ASSET);
  const bogusType = header(bogusRes, 'content-type').split(';')[0].trim().toLowerCase();
  const bogusHtml = bogusType.includes('text/html');
  const bogusOk = !bogusHtml || bogusRes.status === 404;
  line(
    'missing /assets/*.js',
    bogusOk,
    `${bogusRes.status} ${header(bogusRes, 'content-type')}${bogusHtml && bogusRes.ok ? ' ← SPA fallback (no 404.html at dist root?)' : ''}`,
  );
  if (!bogusOk) {
    fail(
      'Missing JS returned HTML with 200. Cloudflare Pages SPA auto-fallback is active — ' +
        'deploy dist/404.html (from apps/web/public/404.html), purge cache, redeploy. ' +
        'See apps/web/DEPLOY.md.',
    );
  }

  // ── 5. Custom 404 shipped (disables Pages SPA assumption) ─────────────────
  const custom404Res = await fetchRetry('/404.html');
  const custom404Html = await custom404Res.text();
  const hasCustom404 = custom404Res.ok && custom404Html.includes('页面未找到');
  line('GET /404.html', hasCustom404, hasCustom404 ? 'custom page present' : 'homepage fallback — redeploy with public/404.html');
  if (!hasCustom404) {
    fail('dist/404.html is missing or not deployed. Build and redeploy so Cloudflare Pages disables SPA fallback.');
  }

  // ── 4. Prerendered routes ───────────────────────────────────────────────
  for (const path of ['/guide', '/en', '/en/guide']) {
    const res = await fetchRetry(path);
    const ok = res.ok && header(res, 'content-type').includes('text/html');
    line(`GET ${path}`, ok, `${res.status}`);
    if (!ok) fail(`Prerendered route ${path} failed.`);
  }

  console.log('\nOK — deploy looks healthy.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
