/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the export API in production, e.g. https://api.next-ppt.com. Empty in dev. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:editor-runtime' {
  /** Compiled editor-runtime.ts source, injected into the canvas iframe. */
  const runtimeSource: string;
  export default runtimeSource;
}
