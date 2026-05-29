/// <reference types="vite/client" />

declare module 'virtual:editor-runtime' {
  /** Compiled editor-runtime.ts source, injected into the canvas iframe. */
  const runtimeSource: string;
  export default runtimeSource;
}
