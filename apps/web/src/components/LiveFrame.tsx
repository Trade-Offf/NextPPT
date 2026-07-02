/**
 * LiveFrame – renders the user's HTML in a sandboxed iframe with scripts
 * ENABLED, so animations and interactions stay alive. The live-runtime is
 * injected as an inlined script; it handles in-place text edits and visual
 * tweaks (translate/scale) and reports back via postMessage.
 *
 * Unlike CanvasFrame (deck editor), this frame never disables scripts, never
 * detaches the layout, and never clamps to 1280×720. The document renders at
 * its natural size — the workbench is a "modify in place" tool.
 */
import { useEffect, useRef, useMemo, type RefObject } from 'react';
import type { LiveRuntimeMessage } from '@hds/protocol';
import LIVE_RUNTIME_SOURCE from 'virtual:live-runtime';

interface LiveFrameProps {
  /** Full HTML document (<!doctype …</html>) to render. */
  sourceHtml: string;
  onMessage?: (msg: LiveRuntimeMessage) => void;
  /** Ref forwarded to the underlying iframe so the parent can postMessage. */
  iframeRef: RefObject<HTMLIFrameElement | null>;
  /** Bump to force a fresh iframe (e.g. when loading a new file). */
  remountKey: string | number;
}

export function LiveFrame({ sourceHtml, onMessage, iframeRef, remountKey }: LiveFrameProps) {
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; });

  // Rebuild srcdoc whenever the source changes OR remountKey bumps (the
  // latter covers "same file re-selected" — a content-equal but intent-fresh
  // load that should still reload the iframe).
  const srcDoc = useMemo(
    () => injectRuntime(sourceHtml, LIVE_RUNTIME_SOURCE),
    [sourceHtml, remountKey],
  );

  useEffect(() => {
    const handler = (evt: MessageEvent) => {
      if (evt.source !== iframeRef.current?.contentWindow) return;
      onMessageRef.current?.(evt.data as LiveRuntimeMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [iframeRef]);

  // The iframe fills its parent. The document inside scrolls on its own — the
  // workbench is a "modify in place" tool, so the user wants the rendered file
  // to occupy the whole canvas, not be wrapped in an outer scroll container
  // that leaves dead space below short documents.
  return (
    <iframe
      key={remountKey}
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-same-origin allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      title="html-workbench"
    />
  );
}

/** Append the live-runtime as an inlined <script data-hds-runtime> right before
 *  </body>. We avoid touching <head> so the user's stylesheets and meta tags
 *  remain byte-identical. */
function injectRuntime(html: string, runtimeSource: string): string {
  const closing = /<\/body>\s*<\/html>\s*$/i;
  const script = `<script data-hds-runtime>${runtimeSource}${'<'}/script>`;
  if (closing.test(html)) {
    return html.replace(closing, `${script}</body></html>`);
  }
  return html + script;
}
