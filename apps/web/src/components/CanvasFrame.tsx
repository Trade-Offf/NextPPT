/**
 * CanvasFrame – renders a single slide in a sandboxed iframe.
 * Communicates with editor-runtime via postMessage.
 */
import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from 'react';
import type { HostMessage, RuntimeMessage } from '@hds/protocol';
import RUNTIME_SOURCE from 'virtual:editor-runtime';
import { useDeckStore } from '../store/deckStore.js';

export interface CanvasHandle {
  sendMessage: (msg: HostMessage) => void;
}

interface CanvasFrameProps {
  /** Outer HTML of the <section class="slide"> (deck) or [data-hds-doc] (doc) */
  sectionHtml: string;
  /** Full <head> innerHTML from the original document (styles, fonts, etc.) */
  headHtml?: string;
  onMessage?: (msg: RuntimeMessage) => void;
  /** Optional external ref to the iframe element */
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  /**
   * Free-edit mode: render the whole document at natural width with auto height
   * (vertical scroll) instead of clamping to a fixed 1280×720 slide.
   */
  docMode?: boolean;
}

export function CanvasFrame({ sectionHtml, headHtml = '', onMessage, iframeRef: externalRef, docMode = false }: CanvasFrameProps) {
  const internalRef = useRef<HTMLIFrameElement>(null);
  const iframeRef = externalRef ?? internalRef;
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onMessageRef.current = onMessage; });

  // Doc mode: the rendered document has its own height — measure it so the
  // iframe grows to fit and the outer container scrolls (no inner scrollbar).
  const [docHeight, setDocHeight] = useState<number | null>(null);

  // Build srcdoc – inject original head so styles/fonts are preserved.
  // Frozen on first render of this mounted instance: the iframe is the live
  // source of truth, so in-iframe edits (which echo back as new sectionHtml)
  // must NOT rewrite srcDoc and reload it. External changes (undo/redo/restore/
  // slide switch) remount this component via a `key`, rebuilding srcDoc fresh.
  const srcDocRef = useRef<string | null>(null);
  if (srcDocRef.current === null) {
    // Doc mode: a LOW-priority reset placed BEFORE the document's own styles, so
    // the doc's authored layout (e.g. body { max-width:210mm; margin:0 auto;
    // padding:11mm 13mm } on a Kami A4 page) always wins. Only generic docs that
    // declare no body rules fall back to these defaults.
    const docReset = `<style>
  html{margin:0;padding:0;}
  body{margin:0;padding:0;box-sizing:border-box;}
  /* The doc wrapper is transparent to layout so body-level CSS still applies. */
  [data-hds-doc]{display:block;}
</style>`;
    // Deck mode: a HIGH-priority override placed AFTER the document's styles
    // (uses !important) to clamp the extracted slide to a fixed 1280×720 frame.
    const deckOverride = `<style>
  html,body{
    width:1280px;height:720px;
    overflow:hidden;
    /* Keep body constraints but don't override slide bg */
    margin:0;padding:0;
    scroll-snap-type:none !important;
  }
  /* Remove body-level centering/gap from original layout */
  body{display:block !important;gap:0 !important;padding:0 !important;}
  /* Ensure the extracted slide fills the viewport */
  section.slide,section[class~="slide"]{
    width:1280px !important;
    min-height:720px !important;
    max-height:720px !important;
    flex-shrink:0 !important;
  }
</style>`;
    const headParts = docMode
      ? `${docReset}\n${headHtml}` // reset first → doc styles win
      : `${headHtml}\n${deckOverride}`; // override last → slide frame wins
    srcDocRef.current = `<!doctype html><html><head>
<meta charset="UTF-8">
${headParts}
</head><body>${sectionHtml}<script data-hds-runtime>${RUNTIME_SOURCE}${'<'}/script></body></html>`;
  }
  const srcdoc = srcDocRef.current;

  useEffect(() => {
    const handler = (evt: MessageEvent) => {
      if (evt.source !== iframeRef.current?.contentWindow) return;
      onMessageRef.current?.(evt.data as RuntimeMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Doc mode height tracking: grow the iframe to the content height and follow
  // late reflow (web fonts, Mermaid SVG, inline edits) via a ResizeObserver.
  useEffect(() => {
    if (!docMode) return;
    const el = iframeRef.current;
    if (!el) return;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const d = el.contentDocument;
      if (!d) return;
      const h = Math.max(
        d.documentElement?.scrollHeight ?? 0,
        d.body?.scrollHeight ?? 0,
      );
      if (h > 0) setDocHeight((prev) => (prev !== h ? h : prev));
    };
    const onLoad = () => {
      measure();
      const d = el.contentDocument;
      if (d) {
        ro = new ResizeObserver(measure);
        if (d.documentElement) ro.observe(d.documentElement);
        if (d.body) ro.observe(d.body);
      }
    };
    el.addEventListener('load', onLoad);
    if (el.contentDocument?.readyState === 'complete') onLoad();
    // A couple of delayed measures catch async font/Mermaid reflow that lands
    // after the initial layout (ResizeObserver covers the rest).
    const t1 = setTimeout(measure, 400);
    const t2 = setTimeout(measure, 1500);
    return () => {
      el.removeEventListener('load', onLoad);
      ro?.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docMode]);

  const postToRuntime = useCallback((msg: HostMessage) => {
    iframeRef.current?.contentWindow?.postMessage(msg, '*');
  }, []);

  // Expose postToRuntime via data attribute so parent can call it
  useEffect(() => {
    const el = iframeRef.current;
    if (el) (el as HTMLIFrameElement & { postToRuntime?: typeof postToRuntime }).postToRuntime = postToRuntime;
  }, [postToRuntime]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-same-origin allow-scripts"
      style={
        docMode
          ? { width: '100%', height: docHeight ?? 800, border: 'none', display: 'block' }
          : { width: 1280, height: 720, border: 'none', display: 'block' }
      }
      title={docMode ? 'doc-canvas' : 'slide-canvas'}
    />
  );
}

/** Scale canvas to fill container width, maintain 16:9 (deck) — or render at
 *  natural width with auto height (doc). */
export const ScaledCanvas = forwardRef<CanvasHandle, CanvasFrameProps & { containerWidth: number }>(
  function ScaledCanvas(props, ref) {
    const { containerWidth, docMode, ...rest } = props;
    const scale = containerWidth / 1280;
    const setSelection = useDeckStore((s) => s.setSelection);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useImperativeHandle(ref, () => ({
      sendMessage: (msg: HostMessage) => {
        iframeRef.current?.contentWindow?.postMessage(msg, '*');
      },
    }));

    const handleMsg = useCallback((msg: RuntimeMessage) => {
      if (msg.type === 'select') {
        setSelection({
          selector: msg.selector,
          tagName: msg.tagName,
          bbox: msg.bbox as unknown as DOMRect,
          styleSnapshot: msg.styleSnapshot,
          attrs: msg.attrs,
          text: msg.text,
          layer: msg.layer,
          rect: msg.rect,
        });
      }
      if (msg.type === 'clear-select') setSelection(null);
      props.onMessage?.(msg);
    }, [props, setSelection]);

    // Doc mode: no transform scaling — the iframe lays out at the container's
    // own width and grows to content height; the outer area scrolls vertically.
    if (docMode) {
      return (
        <div style={{ width: '100%' }}>
          <CanvasFrame {...rest} docMode iframeRef={iframeRef} onMessage={handleMsg} />
        </div>
      );
    }

    return (
      <div
        style={{
          width: containerWidth,
          height: Math.round(containerWidth * (720 / 1280)),
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: 1280,
            height: 720,
          }}
        >
          <CanvasFrame {...rest} iframeRef={iframeRef} onMessage={handleMsg} />
        </div>
      </div>
    );
  }
);
