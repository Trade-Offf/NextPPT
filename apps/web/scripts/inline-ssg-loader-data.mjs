#!/usr/bin/env node
/**
 * Post-SSG step: inline vite-react-ssg static loader manifest + data into every
 * prerendered HTML so hydration never fetches /static-loader-data/*.json.
 *
 * vite-react-ssg skips network when these window globals are already set:
 *   __VITE_REACT_SSG_STATIC_LOADER_MANIFEST__
 *   __VITE_REACT_SSG_STATIC_LOADER_DATA__
 *
 * Usage (from vite ssgOptions.onFinished, or manually):
 *   node scripts/inline-ssg-loader-data.mjs [distDir]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist',
);

/**
 * Recursively collect .html files under dir.
 * @param {string} dir
 * @returns {string[]}
 */
function collectHtmlFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hashed asset bundles; only walk route shells.
      if (entry.name === 'assets') continue;
      out.push(...collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} distDir
 */
export function inlineSsgLoaderData(distDir) {
  const manifests = fs
    .readdirSync(distDir)
    .filter((f) => /^static-loader-data-manifest-.+\.json$/.test(f));

  if (manifests.length === 0) {
    console.warn(
      '[inline-ssg-loader-data] No static-loader-data-manifest-*.json — skip.',
    );
    return { injected: 0, skipped: true };
  }

  if (manifests.length > 1) {
    console.warn(
      `[inline-ssg-loader-data] Multiple manifests found (${manifests.join(', ')}); using ${manifests[0]}.`,
    );
  }

  const manifestFile = manifests[0];
  const manifestPath = path.join(distDir, manifestFile);
  /** @type {Record<string, string>} */
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  /** @type {Record<string, Record<string, unknown>>} */
  const loaderData = {};
  for (const [routePath, relFile] of Object.entries(manifest)) {
    const dataPath = path.join(distDir, relFile);
    if (!fs.existsSync(dataPath)) {
      throw new Error(
        `[inline-ssg-loader-data] Missing loader data file for ${routePath}: ${relFile}`,
      );
    }
    loaderData[routePath] = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  }

  const injectScript =
    `<script>` +
    `window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__=${JSON.stringify(manifest)};` +
    `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__=${JSON.stringify(loaderData)};` +
    `</script>`;

  const hashMarker = /(<script>window\.__VITE_REACT_SSG_HASH__\s*=\s*'[^']*'\s*<\/script>)/;
  const htmlFiles = collectHtmlFiles(distDir);
  let injected = 0;
  let already = 0;

  for (const htmlPath of htmlFiles) {
    let html = fs.readFileSync(htmlPath, 'utf8');

    // Standalone 404.html and non-SSG pages have no HASH marker — skip.
    if (!html.includes('__VITE_REACT_SSG_HASH__')) continue;

    if (html.includes('__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__')) {
      already++;
      continue;
    }

    if (hashMarker.test(html)) {
      html = html.replace(hashMarker, `$1${injectScript}`);
    } else {
      // Fallback: inject before </head>
      html = html.replace(/<\/head>/i, `${injectScript}</head>`);
    }

    fs.writeFileSync(htmlPath, html, 'utf8');
    injected++;
  }

  console.log(
    `[inline-ssg-loader-data] Inlined loader data into ${injected} HTML file(s)` +
      (already ? ` (${already} already inlined)` : '') +
      `.`,
  );

  return { injected, already, skipped: false };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const distDir = path.resolve(process.argv[2] ?? DEFAULT_DIST);
  if (!fs.existsSync(distDir)) {
    console.error(`[inline-ssg-loader-data] Dist not found: ${distDir}`);
    process.exit(1);
  }
  inlineSsgLoaderData(distDir);
}
