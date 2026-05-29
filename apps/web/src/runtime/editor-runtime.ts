/**
 * editor-runtime.ts
 * Injected into the sandboxed iframe via srcdoc as an inlined module script
 * (see the `hds-inline-runtime` plugin in vite.config.ts).
 *
 * Single source of truth for: startup mount, element selection, stable
 * selector, patch application, inline (contenteditable) editing, Mermaid
 * rendering, script disable/restore, and DOM serialization.
 *
 * Communicates with AppHost via postMessage.
 */

import type { HostMessage, RuntimeMessage, PatchOp, StyleSnapshot } from '@hds/protocol';

const TARGET = window.parent as Window;

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
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.setAttribute('data-hds-overlay', '');
    Object.assign(overlay.style, {
      position: 'fixed',
      border: '2px solid #007aff',
      borderRadius: '3px',
      pointerEvents: 'none',
      zIndex: '99999',
      boxSizing: 'border-box',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
    });
    document.body.appendChild(overlay);
  }
  const r = el.getBoundingClientRect();
  Object.assign(overlay.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    display: 'block',
  });
}

function clearOverlay() {
  if (overlay) overlay.style.display = 'none';
}

// ─── Mermaid rendering ───────────────────────────────────────────────────────

let mermaidLoading: Promise<unknown> | null = null;

async function renderMermaid() {
  const nodes = document.querySelectorAll<HTMLElement>(
    'pre.mermaid:not([data-mermaid-rendered]), div.mermaid:not([data-mermaid-rendered]), [data-mermaid]:not([data-mermaid-rendered])',
  );
  if (!nodes.length) return;

  try {
    if (!mermaidLoading) {
      mermaidLoading = import(
        /* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'
      );
    }
    const mod = (await mermaidLoading) as { default: MermaidApi };
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

interface MermaidApi {
  initialize: (cfg: Record<string, unknown>) => void;
  run: (opts: { nodes: Element[] }) => Promise<void>;
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
  document.querySelectorAll<HTMLScriptElement>('script').forEach((s) => {
    // Never disable our own runtime; leave module scripts that drive mermaid alone
    if (s.hasAttribute('data-hds-runtime')) return;
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
    const node = div.firstElementChild;
    if (node) tpl.replaceWith(node);
  });
}

// ─── Serialise current section ───────────────────────────────────────────────

function cleanup(root: ParentNode): void {
  root.querySelectorAll('[data-hds-overlay]').forEach((n) => n.remove());
}

function serializeSection(): string {
  const sec = document.querySelector('section.slide') ?? document.body;
  const clone = sec.cloneNode(true) as HTMLElement;
  cleanup(clone);
  clone
    .querySelectorAll('[contenteditable]')
    .forEach((n) => n.removeAttribute('contenteditable'));
  return clone.outerHTML;
}

// ─── Inline editing ──────────────────────────────────────────────────────────

const TEXT_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'li', 'td', 'th',
  'label', 'a', 'button', 'strong', 'em', 'code', 'figcaption', 'blockquote', 'div',
]);

let editingEl: HTMLElement | null = null;
let editingOriginal = '';

function beginInlineEdit(el: HTMLElement) {
  if (editingEl) finishInlineEdit(true);
  editingEl = el;
  editingOriginal = el.innerHTML;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function finishInlineEdit(commit: boolean) {
  if (!editingEl) return;
  const el = editingEl;
  editingEl = null;
  el.removeAttribute('contenteditable');
  if (!commit) {
    el.innerHTML = editingOriginal;
    return;
  }
  send({ type: 'patched', html: serializeSection() });
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
    if (msg.disabled) disableScripts();
    else restoreScripts();
    return;
  }
});

// ─── Click / selection ───────────────────────────────────────────────────────

document.addEventListener(
  'click',
  (e) => {
    const target = e.target as Element;
    if (editingEl) return; // don't change selection while editing
    if (!target || target === document.body || target === document.documentElement) {
      clearOverlay();
      send({ type: 'clear-select' });
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    showOverlay(target);
    const bbox = target.getBoundingClientRect();
    const attrs: Record<string, string> = {};
    for (const name of ['href', 'target', 'src', 'alt']) {
      const v = target.getAttribute(name);
      if (v !== null) attrs[name] = v;
    }
    send({
      type: 'select',
      selector: buildSelector(target),
      tagName: target.tagName.toLowerCase(),
      bbox: {
        x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
        top: bbox.top, left: bbox.left, bottom: bbox.bottom, right: bbox.right,
      },
      styleSnapshot: styleSnapshot(target),
      attrs,
      text: target.textContent ?? '',
    });
  },
  true,
);

document.addEventListener(
  'dblclick',
  (e) => {
    const target = e.target as HTMLElement;
    if (!target || !TEXT_TAGS.has(target.tagName.toLowerCase())) return;
    // Skip elements that only wrap other block content (let user pick the leaf)
    e.preventDefault();
    e.stopPropagation();
    clearOverlay();
    beginInlineEdit(target);
  },
  true,
);

document.addEventListener(
  'keydown',
  (e) => {
    if (!editingEl) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      finishInlineEdit(false);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      finishInlineEdit(true);
    }
  },
  true,
);

document.addEventListener(
  'blur',
  () => {
    if (editingEl) finishInlineEdit(true);
  },
  true,
);

// ─── Startup mount ───────────────────────────────────────────────────────────
// CanvasFrame embeds the section HTML directly in <body>, so run setup against
// the already-present DOM rather than waiting for an explicit `init` message.

(async function startup() {
  disableScripts();
  await renderMermaid();
  send({ type: 'ready' });
})();
