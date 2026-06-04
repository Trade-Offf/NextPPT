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

import type { HostMessage, RuntimeMessage, PatchOp, StyleSnapshot, LayerInfo, SlideRect } from '@hds/protocol';

const TARGET = window.parent as Window;

function send(msg: RuntimeMessage) {
  TARGET.postMessage(msg, '*');
}

// ─── Stable selector ─────────────────────────────────────────────────────────

function buildSelector(el: Element): string {
  if (el === document.body) return 'body';
  // Inserted/transformable elements carry a stable id so that inserting or
  // deleting siblings never shifts an `nth-of-type` path out from under them.
  const hid = el.getAttribute('data-hds-id');
  if (hid) return `[data-hds-id="${CSS.escape(hid)}"]`;
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const parentEl = cur.parentElement;
    if (!parentEl) break;
    const curTag = cur.tagName;
    // Ignore layout placeholders so they never perturb nth-of-type indices.
    const siblings = Array.from(parentEl.children).filter(
      (c) => c.tagName === curTag && !c.hasAttribute('data-hds-placeholder'),
    );
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

// ─── Selection overlay + transform handles ───────────────────────────────────

const HANDLE_CORNERS = ['nw', 'ne', 'se', 'sw'] as const;
type Corner = (typeof HANDLE_CORNERS)[number];
const HANDLE_CURSOR: Record<Corner, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

let overlay: HTMLElement | null = null;
let handleEls: Record<Corner, HTMLElement> | null = null;
let selectedEl: HTMLElement | null = null;

// Canvas interaction mode (synced from the host via `set-mode`). Strictly
// exclusive: 'edit' = click-select + double-click inline editing (no handles,
// no dragging); 'drag' = freeform move/resize/delete (handles, no inline edit).
let interactionMode: 'edit' | 'drag' = 'edit';

/** A positioned/free element carries a stable id (inserted images or detached shapes). */
function isPositioned(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.hasAttribute('data-hds-id');
}

function ensureOverlay() {
  if (overlay) return;
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
    display: 'none',
  });
  document.body.appendChild(overlay);

  handleEls = {} as Record<Corner, HTMLElement>;
  for (const corner of HANDLE_CORNERS) {
    const h = document.createElement('div');
    h.setAttribute('data-hds-handle', corner);
    Object.assign(h.style, {
      position: 'fixed',
      width: '12px',
      height: '12px',
      margin: '-7px 0 0 -7px',
      borderRadius: '50%',
      background: '#fff',
      border: '2px solid #007aff',
      boxSizing: 'border-box',
      zIndex: '100000',
      display: 'none',
      cursor: HANDLE_CURSOR[corner],
      touchAction: 'none',
    });
    document.body.appendChild(h);
    handleEls[corner] = h;
  }
}

function showOverlay(el: Element) {
  ensureOverlay();
  const r = el.getBoundingClientRect();
  Object.assign(overlay!.style, {
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    display: 'block',
  });
  // Handles only exist in drag mode; in edit mode we just draw the selection
  // outline so the two interaction logics never bleed into each other.
  const showHandles = interactionMode === 'drag';
  const corners: Record<Corner, [number, number]> = {
    nw: [r.left, r.top],
    ne: [r.right, r.top],
    se: [r.right, r.bottom],
    sw: [r.left, r.bottom],
  };
  for (const corner of HANDLE_CORNERS) {
    const h = handleEls![corner];
    if (showHandles) {
      h.style.display = 'block';
      h.style.left = `${corners[corner][0]}px`;
      h.style.top = `${corners[corner][1]}px`;
    } else {
      h.style.display = 'none';
    }
  }
}

function clearOverlay() {
  if (overlay) overlay.style.display = 'none';
  if (handleEls) for (const c of HANDLE_CORNERS) handleEls[c].style.display = 'none';
}

function selectElement(el: Element) {
  selectedEl = el instanceof HTMLElement ? el : null;
  showOverlay(el);
  const bbox = el.getBoundingClientRect();
  const attrs: Record<string, string> = {};
  for (const name of ['href', 'target', 'src', 'alt']) {
    const v = el.getAttribute(name);
    if (v !== null) attrs[name] = v;
  }
  const elh = el instanceof HTMLElement ? el : null;
  send({
    type: 'select',
    selector: buildSelector(el),
    tagName: el.tagName.toLowerCase(),
    bbox: {
      x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height,
      top: bbox.top, left: bbox.left, bottom: bbox.bottom, right: bbox.right,
    },
    styleSnapshot: styleSnapshot(el),
    attrs,
    text: el.textContent ?? '',
    layer: elh ? layerInfo(elh) : undefined,
    rect: elh ? slideRect(elh) : undefined,
  });
}

function deselect() {
  clearOverlay();
  selectedEl = null;
  send({ type: 'clear-select' });
}

// ─── Shape resolution & detach (drag mode) ───────────────────────────────────

function sectionEl(): HTMLElement {
  return (document.querySelector('section.slide') as HTMLElement | null) ?? document.body;
}

/** The containing block a free element is positioned against (its offsetParent). */
function freeParent(el: HTMLElement): HTMLElement {
  return (el.offsetParent as HTMLElement | null) ?? sectionEl();
}

/**
 * Commit an element's current pixel position as percentages of its actual
 * containing block, so it lands exactly where it was dropped (percent units
 * resolve against the offsetParent, not the fixed slide size).
 */
function commitPercentPosition(el: HTMLElement) {
  const p = freeParent(el);
  const pw = p.clientWidth || SLIDE_W;
  const ph = p.clientHeight || SLIDE_H;
  el.style.left = `${round2((el.offsetLeft / pw) * 100)}%`;
  el.style.top = `${round2((el.offsetTop / ph) * 100)}%`;
}

/** Local unique id for detached/inserted shapes (avoids cross-module import in the inlined runtime). */
function genId(): string {
  return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Stacking base for free shapes. Kept high so detached elements / inserted
 * images float above ordinary (and most positioned) deck content. Normalised
 * shapes occupy a contiguous band starting here: Z_BASE, Z_BASE+1, …
 */
const Z_BASE = 9990;

/** Every free (positioned, id-carrying) shape on the slide. */
function freeShapes(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-hds-id]'));
}

/** Next free stacking order above existing free shapes / inserted images. */
function nextZ(): number {
  let max = Z_BASE - 1;
  freeShapes().forEach((n) => {
    const z = parseInt(n.style.zIndex || '0', 10);
    if (!Number.isNaN(z)) max = Math.max(max, z);
  });
  return max + 1;
}

/**
 * Reassign every free shape a unique, contiguous z-index (Z_BASE + position),
 * ordered by current z-index then DOM order. Collapses ties / runaway values
 * into a clean, gap-free stack and returns the elements in stacking order
 * (bottom → top), which is the single source of truth for layer operations.
 */
function normalizeZ(): HTMLElement[] {
  const shapes = freeShapes();
  const domOrder = new Map<HTMLElement, number>();
  shapes.forEach((el, i) => domOrder.set(el, i));
  shapes.sort((a, b) => {
    const za = parseInt(a.style.zIndex || '0', 10) || 0;
    const zb = parseInt(b.style.zIndex || '0', 10) || 0;
    if (za !== zb) return za - zb;
    return (domOrder.get(a) ?? 0) - (domOrder.get(b) ?? 0);
  });
  shapes.forEach((el, i) => {
    el.style.zIndex = String(Z_BASE + i);
  });
  return shapes;
}

/**
 * Re-stack a free element relative to its peers. A flowing element is detached
 * first so its z-index actually applies. The order is normalised before and
 * after the move so values stay contiguous and unambiguous.
 */
function zOrder(selector: string, op: 'front' | 'back' | 'forward' | 'backward') {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return;
  if (!isPositioned(el)) detach(el);

  let order = normalizeZ();
  const i = order.indexOf(el);
  if (i === -1) return;
  const last = order.length - 1;

  let target = i;
  if (op === 'front') target = last;
  else if (op === 'back') target = 0;
  else if (op === 'forward') target = Math.min(last, i + 1);
  else if (op === 'backward') target = Math.max(0, i - 1);

  if (target !== i) {
    order.splice(i, 1);
    order.splice(target, 0, el);
    order.forEach((node, idx) => {
      node.style.zIndex = String(Z_BASE + idx);
    });
  }

  selectElement(el);
  send({ type: 'patched', html: serializeSection() });
}

/** Stacking position of a free element among its peers (1-based), else undefined. */
function layerInfo(el: HTMLElement): LayerInfo | undefined {
  if (!isPositioned(el)) return undefined;
  const order = freeShapes().sort((a, b) => {
    const za = parseInt(a.style.zIndex || '0', 10) || 0;
    const zb = parseInt(b.style.zIndex || '0', 10) || 0;
    return za - zb;
  });
  const idx = order.indexOf(el);
  if (idx === -1) return undefined;
  return { index: idx + 1, count: order.length };
}

/** Element geometry in slide-native coordinates (offset metrics, unscaled). */
function slideRect(el: HTMLElement): SlideRect {
  return {
    left: Math.round(el.offsetLeft),
    top: Math.round(el.offsetTop),
    width: Math.round(el.offsetWidth),
    height: Math.round(el.offsetHeight),
  };
}

const REPLACED_TAGS = new Set(['img', 'svg', 'video', 'canvas', 'figure', 'picture']);

/**
 * In drag mode we select a block-level *shape*, not the raw inline leaf the user
 * clicked. Climb out of pure-inline wrappers to the nearest block/replaced
 * element, stopping at the section.
 */
function resolveShape(start: Element | null): HTMLElement | null {
  const sec = sectionEl();
  let el = start instanceof HTMLElement ? start : null;
  while (el && el !== sec && el !== document.body) {
    if (el.hasAttribute('data-hds-id')) return el;
    if (REPLACED_TAGS.has(el.tagName.toLowerCase())) return el;
    const d = getComputedStyle(el).display;
    if (d !== 'inline' && d !== 'contents') return el;
    el = el.parentElement;
  }
  return el && el !== document.body ? el : (start instanceof HTMLElement ? start : null);
}

type ShapeKind = 'image' | 'text' | 'block';

function shapeKind(el: HTMLElement): ShapeKind {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' || tag === 'svg' || tag === 'video' || tag === 'canvas' || tag === 'picture') {
    return 'image';
  }
  // A leaf text element (no element children) reflows by width; everything else
  // is treated as a group and scaled to preserve its internal layout.
  if (el.childElementCount === 0) return 'text';
  return 'block';
}

/**
 * Reserve an element's original footprint with an invisible placeholder so the
 * surrounding flow does not collapse when the element leaves normal flow. Keyed
 * by the element's hds id so it can be garbage-collected when the element is
 * deleted or restored to auto layout.
 */
function insertPlaceholder(el: HTMLElement, id: string) {
  const cs = getComputedStyle(el);
  const ph = document.createElement('div');
  ph.setAttribute('data-hds-placeholder', '');
  ph.setAttribute('data-hds-ph-for', id);
  Object.assign(ph.style, {
    width: `${el.offsetWidth}px`,
    height: `${el.offsetHeight}px`,
    marginTop: cs.marginTop,
    marginRight: cs.marginRight,
    marginBottom: cs.marginBottom,
    marginLeft: cs.marginLeft,
    alignSelf: cs.alignSelf,
    flex: '0 0 auto',
    boxSizing: 'border-box',
    visibility: 'hidden',
    pointerEvents: 'none',
  });
  el.parentElement?.insertBefore(ph, el);
}

/** Remove placeholders whose owning free element no longer exists. */
function gcPlaceholders() {
  document.querySelectorAll<HTMLElement>('[data-hds-placeholder]').forEach((ph) => {
    const id = ph.getAttribute('data-hds-ph-for');
    if (!id || !document.querySelector(`[data-hds-id="${CSS.escape(id)}"]`)) ph.remove();
  });
}

/**
 * Convert a flowing element into an absolutely-positioned free shape, anchored
 * at its current on-screen box (native iframe coords are unscaled). Idempotent.
 * Leaves a space-reserving placeholder behind so siblings keep their layout.
 */
function detach(el: HTMLElement) {
  if (el.hasAttribute('data-hds-id')) {
    // Already free (detached shape or inserted image): nothing to convert.
    const secEarly = sectionEl();
    if (getComputedStyle(secEarly).position === 'static') secEarly.style.position = 'relative';
    return;
  }
  const sec = sectionEl();
  if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
  // Capture the on-screen box while the element is still in normal flow.
  const r = el.getBoundingClientRect();
  const id = genId();
  el.setAttribute('data-hds-id', id);
  el.setAttribute('data-hds-free', '');
  // Reserve the footprint BEFORE going absolute (measures while still in flow).
  insertPlaceholder(el, id);
  el.style.position = 'absolute';
  el.style.margin = '0';
  el.style.zIndex = String(nextZ());
  // Now the containing block is resolved: anchor the element to its actual
  // offsetParent so it stays exactly where it visually was (no jump on grab).
  const p = freeParent(el);
  const pr = p.getBoundingClientRect();
  el.style.left = `${round2(r.left - pr.left - p.clientLeft)}px`;
  el.style.top = `${round2(r.top - pr.top - p.clientTop)}px`;
  el.style.width = `${round2(r.width)}px`;
  if (shapeKind(el) !== 'image') el.style.height = 'auto';
}

// ─── Auto-detach all content boxes (on entering drag mode) ───────────────────
// A slide is nested (section → titlebar/body/footer → content), so detaching the
// section's direct children alone would leave the title, subtitle, etc. fused
// together. We descend through *layout regions* (large multi-child wrappers) and
// stop at *content boxes* — the perceivable units a user expects to stack/move:
// a heading, a paragraph, an image, or a tight cluster like a meta-card row.

/** Fraction of the slide area above which a multi-child node counts as a layout region. */
const REGION_AREA = 0.22;

/** A rendered, block-level child that participates in layout (not inline/hidden/chrome). */
function isLayoutBlock(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'script' || tag === 'style' || tag === 'template') return false;
  if (el.hasAttribute('data-hds-placeholder')) return false;
  const d = getComputedStyle(el).display;
  if (d === 'none' || d === 'contents' || d.startsWith('inline')) return false;
  return true;
}

function collectFrom(node: HTMLElement, boxes: HTMLElement[]) {
  // Already-free shapes are atomic: never break them apart.
  if (node.hasAttribute('data-hds-id')) {
    boxes.push(node);
    return;
  }
  if (REPLACED_TAGS.has(node.tagName.toLowerCase())) {
    boxes.push(node);
    return;
  }
  const blockKids = Array.from(node.children).filter(isLayoutBlock);
  if (blockKids.length === 0) {
    boxes.push(node); // leaf content block (heading / paragraph / inline-only div)
    return;
  }
  if (blockKids.length === 1) {
    collectFrom(blockKids[0], boxes); // passthrough a single-child wrapper
    return;
  }
  // Multiple block children: a large node is a layout region (recurse); a compact
  // one is a cohesive component (keep whole, e.g. a meta-card row or titlebar).
  const area = (node.offsetWidth * node.offsetHeight) / (SLIDE_W * SLIDE_H);
  if (area >= REGION_AREA) {
    blockKids.forEach((k) => collectFrom(k, boxes));
  } else {
    boxes.push(node);
  }
}

/** The perceivable content boxes of the current slide (see header note). */
function collectContentBoxes(): HTMLElement[] {
  const boxes: HTMLElement[] = [];
  collectFrom(sectionEl(), boxes);
  return boxes;
}

/** Nearest positioned ancestor (the containing block once `el` goes absolute). */
function nearestContainingBlock(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p && p !== document.body) {
    if (getComputedStyle(p).position !== 'static') return p;
    p = p.parentElement;
  }
  return sectionEl();
}

interface DetachPlan {
  el: HTMLElement;
  cb: HTMLElement;
  rect: DOMRect;
  cbRect: DOMRect;
  offsetW: number;
  offsetH: number;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  alignSelf: string;
  inFlow: boolean;
  isImage: boolean;
}

/**
 * Lift every content box out of flow in one pass so the whole slide becomes a
 * set of freely stackable/movable shapes (PPT-like). Idempotent: already-free
 * boxes are skipped. Returns whether anything changed.
 *
 * Done in three strict phases to stay pixel-faithful:
 *   1. Measure ALL boxes up-front (no DOM mutation). Detaching one box reflows
 *      the flow, so measuring first prevents an earlier detach from shifting the
 *      not-yet-measured ones — the root cause of "everything drifts on entering
 *      drag mode" (flex `justify-content: center` re-centred siblings mid-loop).
 *   2. Reserve each in-flow box's footprint with a placeholder, then go absolute.
 *      Out-of-flow boxes (originally absolute/fixed, e.g. a corner badge) get NO
 *      placeholder — reserving phantom space would push flex siblings around.
 *   3. Anchor every box from its phase-1 snapshot (immune to phase-2 reflow).
 */
function detachAll(): boolean {
  const targets = collectContentBoxes().filter((el) => !el.hasAttribute('data-hds-id'));
  if (!targets.length) return false;
  const sec = sectionEl();
  if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';

  // Phase 1 — measure (no mutation).
  const plans: DetachPlan[] = targets.map((el) => {
    const cs = getComputedStyle(el);
    const cb = nearestContainingBlock(el);
    const pos = cs.position;
    return {
      el,
      cb,
      rect: el.getBoundingClientRect(),
      cbRect: cb.getBoundingClientRect(),
      offsetW: el.offsetWidth,
      offsetH: el.offsetHeight,
      marginTop: cs.marginTop,
      marginRight: cs.marginRight,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      alignSelf: cs.alignSelf,
      inFlow: pos === 'static' || pos === 'relative' || pos === 'sticky',
      isImage: shapeKind(el) === 'image',
    };
  });

  // Phase 2 — reserve footprints (in-flow only) and go absolute.
  for (const p of plans) {
    const id = genId();
    p.el.setAttribute('data-hds-id', id);
    p.el.setAttribute('data-hds-free', '');
    if (p.inFlow) {
      const ph = document.createElement('div');
      ph.setAttribute('data-hds-placeholder', '');
      ph.setAttribute('data-hds-ph-for', id);
      Object.assign(ph.style, {
        width: `${p.offsetW}px`,
        height: `${p.offsetH}px`,
        marginTop: p.marginTop,
        marginRight: p.marginRight,
        marginBottom: p.marginBottom,
        marginLeft: p.marginLeft,
        alignSelf: p.alignSelf,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        visibility: 'hidden',
        pointerEvents: 'none',
      });
      p.el.parentElement?.insertBefore(ph, p.el);
    }
    p.el.style.position = 'absolute';
    p.el.style.margin = '0';
  }

  // Phase 3 — anchor from the phase-1 snapshot; preserve size so nothing shifts.
  for (const p of plans) {
    p.el.style.left = `${round2(p.rect.left - p.cbRect.left - p.cb.clientLeft)}px`;
    p.el.style.top = `${round2(p.rect.top - p.cbRect.top - p.cb.clientTop)}px`;
    p.el.style.right = 'auto';
    p.el.style.bottom = 'auto';
    p.el.style.width = `${round2(p.rect.width)}px`;
    // min-height (not height) keeps fixed-height boxes (e.g. a 32px titlebar)
    // from collapsing to content height, while still allowing text to grow.
    if (!p.isImage) p.el.style.minHeight = `${round2(p.rect.height)}px`;
  }

  normalizeZ();
  return true;
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
      // "Restore auto layout" strips an element's hds id; sweep its orphaned placeholder.
      gcPlaceholders();
      await renderMermaid();
      send({ type: 'patched', html: serializeSection() });
    } else {
      send({ type: 'error', code: 'PATCH_SELECTOR_MISS', message: `Selector not found: ${msg.selector}` });
    }
    return;
  }

  if (msg.type === 'insert-image') {
    const sec = (document.querySelector('section.slide') as HTMLElement | null) ?? document.body;
    // Absolute children need a positioned ancestor; most decks already are.
    if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
    const img = document.createElement('img');
    img.setAttribute('data-hds-id', msg.id);
    img.src = msg.src;
    img.draggable = false;
    Object.assign(img.style, {
      position: 'absolute',
      left: `${round2(msg.leftPct)}%`,
      top: `${round2(msg.topPct)}%`,
      width: `${round2(msg.widthPct)}%`,
      height: 'auto',
      // Float above deck content so the image stays clickable/draggable and is
      // not swallowed by positioned siblings (frames, overlays, etc.).
      zIndex: '9999',
      userSelect: 'none',
    });
    sec.appendChild(img);
    selectElement(img);
    send({ type: 'patched', html: serializeSection() });
    return;
  }

  if (msg.type === 'set-mode') {
    if (msg.mode === interactionMode) return; // idempotent: don't clear selection
    interactionMode = msg.mode;
    document.body.setAttribute('data-hds-mode', interactionMode);
    if (editingEl) finishInlineEdit(true);
    // Entering drag mode lifts every content box out of flow so the whole slide
    // becomes freely stackable/movable — z-order then has an immediate effect.
    if (interactionMode === 'drag' && detachAll()) {
      send({ type: 'patched', html: serializeSection() });
    }
    deselect();
    return;
  }

  if (msg.type === 'z-order') {
    zOrder(msg.selector, msg.op);
    return;
  }

  if (msg.type === 'select-element') {
    const el = document.querySelector(msg.selector);
    if (el) selectElement(el);
    return;
  }

  if (msg.type === 'delete-element') {
    const el = document.querySelector(msg.selector);
    if (el) {
      if (el === selectedEl) selectedEl = null;
      el.remove();
      gcPlaceholders();
      clearOverlay();
      send({ type: 'clear-select' });
      send({ type: 'patched', html: serializeSection() });
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
    // Swallow the click that terminates a move/resize gesture.
    if (suppressNextClick) {
      suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Clicks on our own chrome (overlay / handles) must not change selection.
    if (
      target instanceof Element &&
      (target.hasAttribute('data-hds-handle') || target.hasAttribute('data-hds-overlay'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!target || target === document.body || target === document.documentElement) {
      deselect();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    // Edit mode selects the clicked leaf (fine-grained text/style editing);
    // drag mode selects the enclosing block-level shape.
    if (interactionMode === 'drag') {
      const shape = resolveShape(target);
      if (shape && shape !== sectionEl() && shape !== document.body) selectElement(shape);
      else deselect();
    } else {
      selectElement(target);
    }
  },
  true,
);

document.addEventListener(
  'dblclick',
  (e) => {
    if (interactionMode !== 'edit') return; // inline editing is edit-mode only
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

// ─── Freeform transform (move / resize / delete) ─────────────────────────────
// The iframe content lives in native 1280×720 coordinates; the host scales the
// whole iframe via CSS transform, so handles track the canvas automatically and
// no cross-frame coordinate maths are needed here. We only convert to percentage
// units on commit so inserted images stay resolution-independent and export 1:1.

const SLIDE_W = 1280;
const SLIDE_H = 720;
const MIN_SIZE = 24; // px in slide space

interface DragState {
  mode: 'move' | 'resize';
  el: HTMLElement;
  corner?: Corner;
  kind: ShapeKind;
  startX: number;
  startY: number;
  // Baseline geometry, captured lazily on the first real movement (after any
  // detach) so flow elements convert cleanly before we start applying offsets.
  started: boolean;
  left: number;
  top: number;
  offsetW: number;
  offsetH: number;
  visW: number;
  visH: number;
  aspect: number;
  secLeft: number;
  secTop: number;
  moved: boolean;
}

let drag: DragState | null = null;
let suppressNextClick = false;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Read the uniform scale from an inline `transform: scale(n)` (1 if none). */
function currentScale(el: HTMLElement): number {
  const m = /scale\(([-\d.]+)\)/.exec(el.style.transform);
  return m ? parseFloat(m[1]) : 1;
}

function beginDrag(mode: 'move' | 'resize', el: HTMLElement, e: PointerEvent, corner?: Corner) {
  drag = {
    mode,
    el,
    corner,
    kind: shapeKind(el),
    startX: e.clientX,
    startY: e.clientY,
    started: false,
    left: 0,
    top: 0,
    offsetW: 0,
    offsetH: 0,
    visW: 0,
    visH: 0,
    aspect: 1,
    secLeft: 0,
    secTop: 0,
    moved: false,
  };
}

function captureBaseline(d: DragState) {
  const el = d.el;
  d.left = el.offsetLeft;
  d.top = el.offsetTop;
  d.offsetW = el.offsetWidth;
  d.offsetH = el.offsetHeight;
  const r = el.getBoundingClientRect();
  d.visW = r.width;
  d.visH = r.height;
  d.aspect = r.width / Math.max(1, r.height);
  const sr = sectionEl().getBoundingClientRect();
  d.secLeft = sr.left;
  d.secTop = sr.top;
}

function resizeShape(e: PointerEvent) {
  const d = drag!;
  const el = d.el;
  const corner = d.corner!;
  const px = e.clientX - d.secLeft;
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const right0 = d.left + d.visW;
  const bottom0 = d.top + d.visH;
  let w = west ? right0 - px : px - d.left;
  w = Math.max(MIN_SIZE, w);

  if (d.kind === 'image') {
    // Aspect-locked, anchored at the opposite corner.
    const h = w / d.aspect;
    el.style.left = `${west ? right0 - w : d.left}px`;
    el.style.top = `${north ? bottom0 - h : d.top}px`;
    el.style.width = `${w}px`;
    el.style.height = 'auto';
  } else if (d.kind === 'text') {
    // Width-only reflow; height follows content, top stays put.
    el.style.left = `${west ? right0 - w : d.left}px`;
    el.style.top = `${d.top}px`;
    el.style.width = `${w}px`;
    el.style.height = 'auto';
  } else {
    // Group/block: uniform CSS scale to preserve internal layout. Origin sits on
    // the fixed (opposite) corner so that corner stays put; left/top unchanged.
    const scale = w / Math.max(1, d.offsetW);
    el.style.transformOrigin = `${west ? '100%' : '0'} ${north ? '100%' : '0'}`;
    el.style.transform = `scale(${round2(scale)})`;
    el.style.left = `${d.left}px`;
    el.style.top = `${d.top}px`;
  }
}

function applyDrag(e: PointerEvent) {
  if (!drag) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (!drag.started) {
    if (Math.hypot(dx, dy) < 3) return;
    // First real movement: detach flowing elements into absolute positioning,
    // then snapshot the (post-detach) geometry as our baseline.
    if (!isPositioned(drag.el)) detach(drag.el);
    captureBaseline(drag);
    drag.started = true;
  }
  drag.moved = true;
  const el = drag.el;

  if (drag.mode === 'move') {
    let nl = drag.left + dx;
    let nt = drag.top + dy;
    // Keep at least MIN_SIZE of the element on-canvas (small bleed allowed).
    nl = Math.max(MIN_SIZE - drag.visW, Math.min(SLIDE_W - MIN_SIZE, nl));
    nt = Math.max(MIN_SIZE - drag.visH, Math.min(SLIDE_H - MIN_SIZE, nt));
    el.style.left = `${nl}px`;
    el.style.top = `${nt}px`;
  } else {
    resizeShape(e);
  }
  showOverlay(el);
}

function endDrag() {
  if (!drag) return;
  const el = drag.el;
  if (drag.moved) {
    // Persist as percentages of the real containing block: resolution-independent
    // and pixel-exact, so the element stays precisely where it was released.
    const p = freeParent(el);
    const pw = p.clientWidth || SLIDE_W;
    commitPercentPosition(el);
    if (drag.mode === 'resize' && drag.kind !== 'block') {
      el.style.width = `${round2((el.offsetWidth / pw) * 100)}%`;
      if (drag.kind === 'image') el.style.height = 'auto';
    }
    showOverlay(el);
    suppressNextClick = true;
    send({ type: 'patched', html: serializeSection() });
  }
  drag = null;
}

function deleteSelected() {
  if (!selectedEl) return;
  selectedEl.remove();
  selectedEl = null;
  gcPlaceholders();
  clearOverlay();
  send({ type: 'clear-select' });
  send({ type: 'patched', html: serializeSection() });
}

/** Arrow-key nudge (drag mode); detaches a flowing shape on first nudge. */
function nudgeSelected(key: string, shift: boolean) {
  if (!selectedEl) return;
  if (!isPositioned(selectedEl)) detach(selectedEl);
  const el = selectedEl;
  const step = shift ? 10 : 1;
  let dx = 0;
  let dy = 0;
  if (key === 'ArrowLeft') dx = -step;
  else if (key === 'ArrowRight') dx = step;
  else if (key === 'ArrowUp') dy = -step;
  else if (key === 'ArrowDown') dy = step;
  el.style.left = `${el.offsetLeft + dx}px`;
  el.style.top = `${el.offsetTop + dy}px`;
  commitPercentPosition(el);
  showOverlay(el);
  send({ type: 'patched', html: serializeSection() });
}

document.addEventListener(
  'pointerdown',
  (e) => {
    if (editingEl) return;
    if (interactionMode !== 'drag') return; // edit mode selects via click only
    const target = e.target as Element;
    const handle = target.closest?.('[data-hds-handle]') as HTMLElement | null;
    if (handle && selectedEl) {
      e.preventDefault();
      e.stopPropagation();
      beginDrag('resize', selectedEl, e, handle.getAttribute('data-hds-handle') as Corner);
      return;
    }
    const shape = resolveShape(target);
    if (shape && shape !== sectionEl() && shape !== document.body) {
      e.preventDefault();
      if (selectedEl !== shape) selectElement(shape);
      beginDrag('move', shape, e);
    }
  },
  true,
);

document.addEventListener('pointermove', (e) => { if (drag) applyDrag(e); }, true);
document.addEventListener('pointerup', () => { if (drag) endDrag(); }, true);

document.addEventListener(
  'keydown',
  (e) => {
    if (editingEl) {
      if (e.key === 'Escape') {
        e.preventDefault();
        finishInlineEdit(false);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishInlineEdit(true);
      }
      return;
    }
    if (!selectedEl) return;
    if (interactionMode === 'drag') {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        nudgeSelected(e.key, e.shiftKey);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // Climb to the parent shape; deselect when already at the top level.
        const parent = selectedEl.parentElement;
        const up = parent ? resolveShape(parent) : null;
        if (up && up !== selectedEl && up !== sectionEl() && up !== document.body) {
          selectElement(up);
        } else {
          deselect();
        }
      }
      return;
    }
    // Edit mode: Escape just clears the selection.
    if (e.key === 'Escape') {
      e.preventDefault();
      deselect();
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
  // Runtime-only affordances for inserted images. Lives in <head>, so it is
  // never captured by serializeSection() and never reaches the saved/exported HTML.
  const style = document.createElement('style');
  style.setAttribute('data-hds-style', '');
  style.textContent =
    '[data-hds-id]{touch-action:none;-webkit-user-drag:none;}' +
    // Move/resize affordances are scoped to drag mode so edit mode stays calm.
    '[data-hds-mode="drag"] [data-hds-id]{cursor:move;}' +
    '[data-hds-mode="drag"] [data-hds-id]:hover{outline:1px dashed rgba(0,122,255,0.5);outline-offset:1px;}';
  document.head.appendChild(style);
  document.body.setAttribute('data-hds-mode', interactionMode);

  disableScripts();
  await renderMermaid();
  send({ type: 'ready' });
})();
