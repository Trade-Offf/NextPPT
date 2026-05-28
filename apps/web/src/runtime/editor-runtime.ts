/**
 * editor-runtime.ts
 * Injected into the sandboxed iframe via srcdoc.
 * Handles: element selection, stable selector, patch application, serialization.
 * Communicates with AppHost via postMessage.
 *
 * This file is built separately and inlined as a string by the build pipeline.
 */

import type { HostMessage, RuntimeMessage, PatchOp, StyleSnapshot } from '@hds/protocol';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TARGET = (window as any).parent as Window;

function send(msg: RuntimeMessage) {
  TARGET.postMessage(msg, '*');
}

// ─── Stable selector ─────────────────────────────────────────────────────────

function buildSelector(el: Element): string {
  if (el === document.body) return 'body';
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const parentEl = cur.parentElement;
    if (!parentEl) break;
    const curTag = cur.tagName;
    const siblings = Array.from(parentEl.children).filter((c) => c.tagName === curTag);
    const idx = siblings.indexOf(cur) + 1;
    parts.unshift(siblings.length === 1 ? tag : `${tag}:nth-of-type(${idx})`);
    cur = parentEl;
  }
  return parts.join(' > ');
}

// ─── Style snapshot ──────────────────────────────────────────────────────────

function styleSnapshot(el: Element): StyleSnapshot {
  const cs = getComputedStyle(el);
  return {
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    color: cs.color,
    textAlign: cs.textAlign,
    textDecoration: cs.textDecoration,
  };
}

// ─── Selection overlay ───────────────────────────────────────────────────────

let overlay: HTMLElement | null = null;

function showOverlay(el: Element) {
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  const r = el.getBoundingClientRect();
  Object.assign(overlay.style, {
    position: 'fixed',
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    border: '2px solid #1d4ed8',
    borderRadius: '2px',
    pointerEvents: 'none',
    zIndex: '99999',
    boxSizing: 'border-box',
  });
  document.body.appendChild(overlay);
}

function clearOverlay() {
  overlay?.remove();
  overlay = null;
}

// ─── Mermaid rendering ───────────────────────────────────────────────────────

async function renderMermaid() {
  const nodes = document.querySelectorAll<HTMLElement>(
    'pre.mermaid:not([data-mermaid-rendered]), div.mermaid:not([data-mermaid-rendered]), [data-mermaid]:not([data-mermaid-rendered])',
  );
  if (!nodes.length) return;

  try {
    // @ts-expect-error dynamic cdn import in iframe context
    const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
    const mermaid = mod.default;
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
    await mermaid.run({ nodes: Array.from(nodes) });
    nodes.forEach((n) => n.setAttribute('data-mermaid-rendered', 'true'));
  } catch (err) {
    nodes.forEach((n) => {
      n.setAttribute('data-mermaid-error', String(err));
      n.style.outline = '2px solid #fca5a5';
    });
  }
}

// ─── Patch application ───────────────────────────────────────────────────────

function applyPatch(selector: string, ops: PatchOp[]): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  for (const op of ops) {
    if (op.kind === 'text') {
      el.textContent = op.value;
    } else if (op.kind === 'attr') {
      if (op.value === null) el.removeAttribute(op.name);
      else el.setAttribute(op.name, op.value);
    } else if (op.kind === 'style') {
      if (op.value === null) (el as HTMLElement).style.removeProperty(op.name);
      else (el as HTMLElement).style.setProperty(op.name, op.value);
    } else if (op.kind === 'class') {
      op.add?.forEach((c) => el.classList.add(c));
      op.remove?.forEach((c) => el.classList.remove(c));
    }
  }
  return true;
}

// ─── Script disable/restore ──────────────────────────────────────────────────

const scriptMap = new WeakMap<HTMLTemplateElement, string>();

function disableScripts() {
  document.querySelectorAll<HTMLScriptElement>('script[data-hds-original]').forEach(() => {});
  document.querySelectorAll<HTMLScriptElement>('script').forEach((s) => {
    if (s.hasAttribute('data-hds-disabled')) return;
    const tpl = document.createElement('template');
    tpl.setAttribute('data-hds-disabled', '');
    scriptMap.set(tpl, s.outerHTML);
    s.replaceWith(tpl);
  });
}

function restoreScripts() {
  document.querySelectorAll<HTMLTemplateElement>('template[data-hds-disabled]').forEach((tpl) => {
    const original = scriptMap.get(tpl);
    if (!original) return;
    const div = document.createElement('div');
    div.innerHTML = original;
    tpl.replaceWith(div.firstElementChild!);
  });
}

// ─── Serialise current section ───────────────────────────────────────────────

function serializeSection(): string {
  return document.querySelector('section.slide')?.outerHTML ?? '';
}

// ─── Message handler ─────────────────────────────────────────────────────────

window.addEventListener('message', async (evt) => {
  const msg = evt.data as HostMessage;
  if (!msg?.type) return;

  if (msg.type === 'init') {
    document.body.innerHTML = msg.sectionHtml;
    disableScripts();
    await renderMermaid();
    send({ type: 'ready' });
    return;
  }

  if (msg.type === 'patch') {
    const ok = applyPatch(msg.selector, msg.ops);
    if (ok) {
      await renderMermaid();
      send({ type: 'patched', html: serializeSection() });
    } else {
      send({ type: 'error', code: 'PATCH_SELECTOR_MISS', message: `Selector not found: ${msg.selector}` });
    }
    return;
  }

  if (msg.type === 'request-html') {
    send({ type: 'response-html', html: serializeSection() });
    return;
  }

  if (msg.type === 'disable-scripts') {
    msg.disabled ? disableScripts() : restoreScripts();
    return;
  }
});

// ─── Click handler ───────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const target = e.target as Element;
  if (!target || target === document.body) {
    clearOverlay();
    send({ type: 'clear-select' });
    return;
  }
  e.preventDefault();
  e.stopPropagation();

  showOverlay(target);
  const bbox = target.getBoundingClientRect();
  send({
    type: 'select',
    selector: buildSelector(target),
    tagName: target.tagName.toLowerCase(),
    bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height, top: bbox.top, left: bbox.left, bottom: bbox.bottom, right: bbox.right },
    styleSnapshot: styleSnapshot(target),
  });
}, true);

// Init complete
send({ type: 'ready' });
