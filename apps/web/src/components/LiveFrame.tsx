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

/** Inject the live-runtime + a head shim right before </body>.
 *
 *  The head shim runs BEFORE the user's scripts and patches two cross-origin
 *  problems caused by loading via srcdoc (iframe origin is `about:srcdoc`,
 *  which differs from the host site):
 *
 *    1. `history.replaceState/pushState` with a URL argument throws a
 *       SecurityError because the URL's origin differs from `about:srcdoc`.
 *       Many deck scripts (reveal.js-style) call these on every page flip to
 *       sync the URL hash. We strip the URL argument so only the hash is
 *       applied, which is same-origin safe.
 *
 *    2. Relative asset URLs (images, fonts) resolve against `about:srcdoc`
 *       and 404. A <base> tag re-targets them to the host site so local
 *       assets with paths like `assets/x.png` resolve correctly.
 */
function injectRuntime(html: string, runtimeSource: string): string {
  const base = `<base data-hds-shim href="${location.origin}${location.pathname}">`;
  const shim = `<script data-hds-shim>(function(){var P=History.prototype;var wrap=function(fn){return function(state,title,url){return fn.call(this,state,title)}};P.replaceState=wrap(P.replaceState);P.pushState=wrap(P.pushState)})()</script>`;
  const runtime = `<script data-hds-runtime>${runtimeSource}${'<'}/script>`;

  // Inject <base> + shim as the first children of <head> so they take effect
  // before any user stylesheet or script. Runtime goes before </body> as usual.
  const headOpen = /<head[^>]*>/i;
  const closing = /<\/body>\s*<\/html>\s*$/i;
  let out = html;
  if (headOpen.test(out)) {
    out = out.replace(headOpen, (m) => `${m}${base}${shim}`);
  } else {
    out = `${base}${shim}${out}`;
  }
  if (closing.test(out)) {
    out = out.replace(closing, `${runtime}</body></html>`);
  } else {
    out = out + runtime;
  }
  return out;
}
