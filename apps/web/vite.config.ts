import { defineConfig, transformWithEsbuild, type Plugin } from 'vite';
// Loads vite-react-ssg's `declare module 'vite'` augmentation so `ssgOptions`
// is recognised on the Vite config below.
import type {} from 'vite-react-ssg';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Compiles src/runtime/editor-runtime.ts to JS and exposes it as a string via
 * the virtual module `virtual:editor-runtime`, so CanvasFrame can inline it as
 * a <script> inside the sandboxed srcdoc iframe (no cross-origin / CORS issues).
 */
function inlineRuntime(): Plugin {
  const virtualId = 'virtual:editor-runtime';
  const resolvedId = '\0' + virtualId;
  const runtimePath = path.resolve(__dirname, 'src/runtime/editor-runtime.ts');
  return {
    name: 'hds-inline-runtime',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      this.addWatchFile(runtimePath);
      const source = fs.readFileSync(runtimePath, 'utf8');
      const { code } = await transformWithEsbuild(source, runtimePath, {
        loader: 'ts',
        format: 'esm',
        target: 'es2020',
      });
      return `export default ${JSON.stringify(code)};`;
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineRuntime()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': 'http://localhost:3000',
    },
  },
  // vite-react-ssg: prerender one localized shell per route (zh + /en).
  // `nested` → dist/guide/index.html, dist/en/index.html, dist/en/guide/index.html.
  ssgOptions: {
    dirStyle: 'nested',
    includedRoutes: () => [
      '/', '/guide', '/templates', '/explore', '/explore/feishu-whiteboard',
      '/en', '/en/guide', '/en/templates', '/en/explore', '/en/explore/feishu-whiteboard',
    ],
  },
});
