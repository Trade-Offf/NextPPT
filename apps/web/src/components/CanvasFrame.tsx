/**
 * CanvasFrame – renders a single slide in a sandboxed iframe.
 * Communicates with editor-runtime via postMessage.
 */
import { useEffect, useRef, useCallback } from 'react';
import type { HostMessage, RuntimeMessage } from '@hds/protocol';
import { useDeckStore } from '../store/deckStore.js';

// Inline the runtime script source (vite will inline via ?raw import)
// For now we embed a minimal stub; the real runtime is compiled separately.
const RUNTIME_STUB = `
(function(){
  var TARGET=window.parent;
  function send(m){TARGET.postMessage(m,'*');}
  function buildSel(el){
    if(el===document.body)return 'body';
    var parts=[];var cur=el;
    while(cur&&cur!==document.body){
      var tag=cur.tagName.toLowerCase();var parent=cur.parentElement;if(!parent)break;
      var sibs=Array.from(parent.children).filter(function(c){return c.tagName===cur.tagName;});
      var idx=sibs.indexOf(cur)+1;
      parts.unshift(sibs.length===1?tag:tag+':nth-of-type('+idx+')');
      cur=parent;
    }
    return parts.join(' > ');
  }
  var overlay=null;
  function showOverlay(el){
    if(overlay)overlay.remove();
    overlay=document.createElement('div');
    var r=el.getBoundingClientRect();
    Object.assign(overlay.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',border:'2px solid #1d4ed8',borderRadius:'2px',pointerEvents:'none',zIndex:'99999',boxSizing:'border-box'});
    document.body.appendChild(overlay);
  }
  function clearOverlay(){if(overlay){overlay.remove();overlay=null;}}
  function styleSnapshot(el){var cs=getComputedStyle(el);return{fontSize:cs.fontSize,fontWeight:cs.fontWeight,color:cs.color,textAlign:cs.textAlign,textDecoration:cs.textDecoration};}
  function applyPatch(sel,ops){
    var el=document.querySelector(sel);if(!el)return false;
    ops.forEach(function(op){
      if(op.kind==='text'){el.textContent=op.value;}
      else if(op.kind==='attr'){op.value===null?el.removeAttribute(op.name):el.setAttribute(op.name,op.value);}
      else if(op.kind==='style'){op.value===null?el.style.removeProperty(op.name):el.style.setProperty(op.name,op.value);}
      else if(op.kind==='class'){(op.add||[]).forEach(function(c){el.classList.add(c);});(op.remove||[]).forEach(function(c){el.classList.remove(c);});}
    });return true;
  }
  function serialize(){return(document.querySelector('section.slide')||document.body).outerHTML;}
  window.addEventListener('message',function(evt){
    var msg=evt.data;if(!msg||!msg.type)return;
    if(msg.type==='init'){document.body.innerHTML=msg.sectionHtml;send({type:'ready'});return;}
    if(msg.type==='patch'){var ok=applyPatch(msg.selector,msg.ops);ok?send({type:'patched',html:serialize()}):send({type:'error',code:'PATCH_SELECTOR_MISS',message:'not found: '+msg.selector});return;}
    if(msg.type==='request-html'){send({type:'response-html',html:serialize()});return;}
  });
  document.addEventListener('click',function(e){
    var target=e.target;
    if(!target||target===document.body){clearOverlay();send({type:'clear-select'});return;}
    e.preventDefault();e.stopPropagation();
    showOverlay(target);
    var r=target.getBoundingClientRect();
    send({type:'select',selector:buildSel(target),tagName:target.tagName.toLowerCase(),bbox:{x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,left:r.left,bottom:r.bottom,right:r.right},styleSnapshot:styleSnapshot(target)});
  },true);
  send({type:'ready'});
})();
`;

interface CanvasFrameProps {
  /** Outer HTML of the <section class="slide"> */
  sectionHtml: string;
  /** Base URL so relative assets resolve (file:// or blob:) */
  assetsBaseUrl: string;
  onMessage?: (msg: RuntimeMessage) => void;
}

export function CanvasFrame({ sectionHtml, assetsBaseUrl, onMessage }: CanvasFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  // Build srcdoc
  const srcdoc = `<!doctype html><html><head>
<meta charset="UTF-8">
<base href="${assetsBaseUrl}">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body{width:1280px;height:720px;overflow:hidden;background:#fff;}
</style>
</head><body>${sectionHtml}<script>${RUNTIME_STUB}<\/script></body></html>`;

  useEffect(() => {
    const handler = (evt: MessageEvent) => {
      if (evt.source !== iframeRef.current?.contentWindow) return;
      onMessageRef.current?.(evt.data as RuntimeMessage);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

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
      style={{ width: 1280, height: 720, border: 'none', display: 'block' }}
      title="slide-canvas"
    />
  );
}

/** Scale canvas to fill container width, maintain 16:9 */
export function ScaledCanvas(props: CanvasFrameProps & { containerWidth: number }) {
  const { containerWidth, ...rest } = props;
  const scale = containerWidth / 1280;
  const setSelection = useDeckStore((s) => s.setSelection);

  const handleMsg = useCallback((msg: RuntimeMessage) => {
    if (msg.type === 'select') {
      setSelection({
        selector: msg.selector,
        tagName: msg.tagName,
        bbox: msg.bbox as unknown as DOMRect,
        styleSnapshot: msg.styleSnapshot,
      });
    }
    if (msg.type === 'clear-select') setSelection(null);
    props.onMessage?.(msg);
  }, [props, setSelection]);

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
        <CanvasFrame {...rest} onMessage={handleMsg} />
      </div>
    </div>
  );
}
