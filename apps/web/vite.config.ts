import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
// Loads vite-react-ssg's `declare module 'vite'` augmentation so `ssgOptions`
// is recognised on the Vite config below.
import type {} from 'vite-react-ssg';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Compiles a runtime .ts source to JS and exposes it as a string via a virtual
 * module, so the host can inline it as a <script> inside the sandboxed srcdoc
 * iframe (no cross-origin / CORS issues).
 *
 * Each entry maps `virtual:<id>` → a source file under src/runtime/.
 */
function inlineRuntime(entries: { id: string; file: string }[]): Plugin {
  const resolved = entries.map((e) => ({
    virtualId: `virtual:${e.id}`,
    resolvedId: `\0virtual:${e.id}`,
    runtimePath: path.resolve(__dirname, e.file),
  }));
  return {
    name: 'hds-inline-runtime',
    resolveId(id) {
      return resolved.find((r) => r.virtualId === id)?.resolvedId;
    },
    async load(id) {
      const entry = resolved.find((r) => r.resolvedId === id);
      if (!entry) return;
      this.addWatchFile(entry.runtimePath);
      const source = fs.readFileSync(entry.runtimePath, 'utf8');
      const { code } = await transformWithEsbuild(source, entry.runtimePath, {
        loader: 'ts',
        format: 'esm',
        target: 'es2020',
      });
      return `export default ${JSON.stringify(code)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineRuntime([
    { id: 'editor-runtime', file: 'src/runtime/editor-runtime.ts' },
    { id: 'live-runtime', file: 'src/runtime/live-runtime.ts' },
  ])],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:3310',
    },
  },
  // vite-react-ssg: prerender one localized shell per route (zh + /en).
  // `nested` → dist/guide/index.html, dist/en/index.html, dist/en/guide/index.html.
  ssgOptions: {
    dirStyle: 'nested',
    includedRoutes: () => {
      // Read template ids from the data source so SSG stays in sync with TEMPLATES.
      const src = fs.readFileSync(
        path.resolve(__dirname, 'src/data/templates.ts'),
        'utf-8',
      );
      const templateIds = [...src.matchAll(/id:\s*'([^']+)'/g)].map((m) => m[1]);
      const templateRoutes = templateIds.map((id) => `/templates/${id}`);
      const enTemplateRoutes = templateIds.map((id) => `/en/templates/${id}`);
      return [
        '/', '/guide', '/guide/generate', '/guide/edit', '/guide/export', '/templates', '/html',
        '/en', '/en/guide', '/en/guide/generate', '/en/guide/edit', '/en/guide/export', '/en/templates', '/en/html',
        ...templateRoutes,
        ...enTemplateRoutes,
      ];
    },
    // Inline static loader JSON into every shell so hydration never fetch()es
    // /static-loader-data/*.json (those requests often fail with CONNECTION_RESET
    // on CF Pages and crash the app — see scripts/inline-ssg-loader-data.mjs).
    async onFinished(dir) {
      const { execFileSync } = await import('node:child_process');
      execFileSync(
        process.execPath,
        [path.resolve(__dirname, 'scripts/inline-ssg-loader-data.mjs'), dir],
        { stdio: 'inherit' },
      );
    },
  },
});
