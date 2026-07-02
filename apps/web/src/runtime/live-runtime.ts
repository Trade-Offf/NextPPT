/**
 * live-runtime.ts
 *
 * Injected into the HTML workbench's sandboxed iframe. In contrast to
 * editor-runtime.ts, this runtime deliberately LEAVES the user's <script>
 * tags intact so animations and interactions keep running.
 *
 * Three responsibilities, each designed to be minimally invasive:
 *
 *   1. Text edits  – contenteditable on double-click. Patches go back to the
 *                    host as serialized body HTML. The DOM is mutated in place
 *                    so the original scripts/animation state is preserved.
 *
 *   2. Visual tweak – move and resize use the independent CSS `translate` /
 *                    `scale` properties. These compose with the original
 *                    `transform` (GSAP, CSS animations) instead of overwriting
 *                    it, so animations stay alive while the element is moved
 *                    or scaled.
 *
 *   3. Serialization – on request, returns the full document HTML with text
 *                      edits + tweak inline styles baked in. Tweak markers
 *                      (`data-hds-tweak-id`) are stripped so the exported file
 *                      is clean. Based on a cloneNode snapshot: any DOM the
 *                      user's scripts mutated at runtime is captured, but
 *                      canvas bitmaps / shadow DOM are not (browser limitation).
 *
 * No detach, no snap, no z-order, no placeholder — the workbench is a
 * "modify in place" tool, not a layout redesigner.
 *
 * ── Editing mode vs browse mode ────────────────────────────────────────────
 * The user's HTML may use Space / Arrow keys to flip pages or trigger
 * animations (reveal.js, impress.js, Slidev). Those keys are also needed for
 * text editing. We resolve the conflict with an explicit editing mode:
 *
 *   • Browse mode (default): Space / Arrows pass through to the user's scripts.
 *   • Editing mode (entered via double-click): Space / Arrows are intercepted
 *     on the capture phase and used for text editing only. A visible orange
 *     outline + "editing" badge tells the user which mode they're in.
 *
 * Esc exits editing mode (discards the edit). Clicking outside commits it.
 */

import type {
  ChangeSummary,
  LiveHostMessage,
  LiveRuntimeMessage,
} from '@hds/protocol';

const TARGET = window.parent as Window;

function send(msg: LiveRuntimeMessage) {
  TARGET.postMessage(msg, '*');
}

// ─── Tweak id stamping ──────────────────────────────────────────────────────

const TWEAK_ATTR = 'data-hds-tweak-id';
const CHROME_ATTR = 'data-hds-live-chrome';

/** Cached element lookup by tweakId (avoids querySelector on every diff). */
const elementCache = new Map<string, HTMLElement>();

/** Snapshot of each element's initial state, captured at boot. Used only by
 *  recomputeDirty (after undo/redo/reset) to decide whether a touched element
 *  has reverted to its original state and should drop out of the dirty set. */
const initialSnapshots = new Map<string, { translate: string; scale: string; text: string }>();

function stampTweakIds() {
  let i = 0;
  const skipTags = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK', 'META', 'TITLE', 'BASE', 'NOSCRIPT', 'HEAD']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const el = node as Element;
      if (skipTags.has(el.tagName)) return NodeFilter.FILTER_REJECT;
      if (el.closest(`[${CHROME_ATTR}]`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  while (walker.nextNode()) {
    const el = walker.currentNode as HTMLElement;
    const id = `t${i++}`;
    el.setAttribute(TWEAK_ATTR, id);
    elementCache.set(id, el);
    initialSnapshots.set(id, {
      translate: el.style.translate,
      scale: el.style.scale,
      text: el.textContent || '',
    });
  }
}

// ─── Change tracking ───────────────────────────────────────────────────────
//
// We track which elements the USER explicitly modified (via drag / scale /
// text edit / reset), keyed by tweakId with the kinds of changes applied.
// We deliberately do NOT diff against the initial snapshot, because the
// user's own scripts (GSAP, page-flip, counters) may mutate textContent /
// translate / scale at runtime, and those script-driven mutations must NOT
// be reported as user edits.

const dirtyElements = new Map<string, Set<string>>(); // tweakId → kinds

function markDirty(tweakId: string, kind: string) {
  let kinds = dirtyElements.get(tweakId);
  if (!kinds) { kinds = new Set(); dirtyElements.set(tweakId, kinds); }
  kinds.add(kind);
}

function computeChanges(): ChangeSummary[] {
  const result: ChangeSummary[] = [];
  dirtyElements.forEach((kinds, id) => {
    const el = elementCache.get(id);
    if (!el || !el.isConnected) { dirtyElements.delete(id); return; }
    const preview = (el.textContent || '').trim().slice(0, 40) || el.tagName.toLowerCase();
    result.push({ tweakId: id, tagName: el.tagName.toLowerCase(), kinds: Array.from(kinds), preview });
  });
  return result;
}

function notifyChanges() {
  send({ type: 'live-changes-updated', changes: computeChanges() });
}

// ─── Undo / Redo stack ──────────────────────────────────────────────────────
//
// Each history entry is a snapshot of the elements that an operation touched,
// captured BEFORE the operation was applied. Undo restores the snapshot; redo
// re-applies the post-operation state which we also capture.
//
// We snapshot by tweakId + { translate, scale, html } so undo is surgical
// (only the touched element reverts) rather than rolling back the whole body.

interface ElementSnapshot {
  translate: string;
  scale: string;
  html: string;
}

interface HistoryEntry {
  /** Snapshots before the operation (for undo). */
  before: Map<string, ElementSnapshot>;
  /** Snapshots after the operation (for redo). */
  after: Map<string, ElementSnapshot>;
}

const undoStack: HistoryEntry[] = [];
const redoStack: HistoryEntry[] = [];
const MAX_UNDO = 100;

function snapshotElement(el: HTMLElement): ElementSnapshot {
  return {
    translate: el.style.translate,
    scale: el.style.scale,
    html: el.innerHTML,
  };
}

function snapshotElements(els: HTMLElement[]): Map<string, ElementSnapshot> {
  const m = new Map<string, ElementSnapshot>();
  for (const el of els) {
    const id = el.getAttribute(TWEAK_ATTR);
    if (id) m.set(id, snapshotElement(el));
  }
  return m;
}

function restoreSnapshot(snap: Map<string, ElementSnapshot>) {
  snap.forEach((s, id) => {
    const el = elementCache.get(id);
    if (!el) return;
    el.style.translate = s.translate;
    el.style.scale = s.scale;
    if (el.innerHTML !== s.html) el.innerHTML = s.html;
    if (selected === el) {
      syncSelectionBox();
      send({
        type: 'live-select',
        tweakId: id,
        tagName: el.tagName.toLowerCase(),
        text: el.textContent?.slice(0, 200) || undefined,
        translate: el.style.translate || undefined,
        scale: el.style.scale || undefined,
      });
    }
  });
  recomputeDirty(snap);
}

/** After an undo/redo/reset, re-evaluate whether each touched element is still
 *  different from its initial state. If it has reverted to initial, drop it
 *  from the dirty set; otherwise keep its kinds. */
function recomputeDirty(touched: Map<string, ElementSnapshot>) {
  touched.forEach((_, id) => {
    const el = elementCache.get(id);
    const init = initialSnapshots.get(id);
    if (!el || !init) { dirtyElements.delete(id); return; }
    const kinds = new Set<string>();
    if (el.style.translate !== init.translate) kinds.add('move');
    if (el.style.scale !== init.scale) kinds.add('scale');
    if ((el.textContent || '') !== init.text) kinds.add('text');
    if (kinds.size === 0) dirtyElements.delete(id);
    else dirtyElements.set(id, kinds);
  });
}

/** Begin an operation: snapshot the elements that will be touched, so the
 *  snapshot can be used as the "before" state of a history entry. */
function beginOperation(els: HTMLElement[]): Map<string, ElementSnapshot> {
  return snapshotElements(els);
}

/** Commit an operation: snapshot the same elements again as the "after" state,
 *  push the entry onto the undo stack, clear the redo stack. Returns false for
 *  a no-op (e.g. a drag that never moved) so the caller can skip markDirty. */
function commitOperation(before: Map<string, ElementSnapshot>, els: HTMLElement[]): boolean {
  const after = snapshotElements(els);
  let changed = false;
  before.forEach((b, id) => {
    const a = after.get(id);
    if (!a || a.translate !== b.translate || a.scale !== b.scale || a.html !== b.html) {
      changed = true;
    }
  });
  if (!changed) return false;
  undoStack.push({ before, after });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  notifyHistory();
  return true;
}

function undo() {
  const entry = undoStack.pop();
  if (!entry) return;
  // Current state becomes the redo "after" (it already is entry.after, but the
  // user may have re-selected since). Restore "before" to roll back.
  restoreSnapshot(entry.before);
  redoStack.push(entry);
  notifyHistory();
  notifyChanges();
  send({ type: 'live-patched', bodyHtml: document.body.innerHTML });
}

function redo() {
  const entry = redoStack.pop();
  if (!entry) return;
  restoreSnapshot(entry.after);
  undoStack.push(entry);
  notifyHistory();
  notifyChanges();
  send({ type: 'live-patched', bodyHtml: document.body.innerHTML });
}

function notifyHistory() {
  send({ type: 'live-history-changed', canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
}

// ─── Overlay layer ──────────────────────────────────────────────────────────

let overlayLayer: HTMLDivElement | null = null;

function ensureOverlayLayer(): HTMLDivElement {
  if (overlayLayer && overlayLayer.isConnected) return overlayLayer;
  const layer = document.createElement('div');
  layer.setAttribute(CHROME_ATTR, '');
  layer.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    'z-index:2147483647',
  ].join(';');
  document.body.appendChild(layer);
  overlayLayer = layer;
  return layer;
}

// ─── Selection ──────────────────────────────────────────────────────────────

let selected: HTMLElement | null = null;
let selectionOutline: HTMLDivElement | null = null;
let scaleHandle: HTMLDivElement | null = null;
let elementObserver: ResizeObserver | null = null;
let editingBadge: HTMLDivElement | null = null;

function clearSelectionUI() {
  selectionOutline?.remove();
  selectionOutline = null;
  scaleHandle?.remove();
  scaleHandle = null;
  editingBadge?.remove();
  editingBadge = null;
  if (elementObserver) {
    elementObserver.disconnect();
    elementObserver = null;
  }
}

function ensureSelectionChrome(): HTMLDivElement {
  if (selectionOutline && selectionOutline.isConnected) return selectionOutline;
  const layer = ensureOverlayLayer();
  const box = document.createElement('div');
  box.setAttribute(CHROME_ATTR, '');
  box.style.cssText = [
    'position:absolute',
    'pointer-events:none',
    'border:1.5px solid #f78166',
    'z-index:2147483646',
    'transition:border-color .12s ease',
  ].join(';');
  layer.appendChild(box);
  selectionOutline = box;
  return box;
}

function syncSelectionBox() {
  if (!selected || !selectionOutline) return;
  const r = selected.getBoundingClientRect();
  selectionOutline.style.left = `${r.left}px`;
  selectionOutline.style.top = `${r.top}px`;
  selectionOutline.style.width = `${r.width}px`;
  selectionOutline.style.height = `${r.height}px`;
  syncScaleHandle();
  syncEditingBadge();
}

function selectElement(el: HTMLElement) {
  if (selected === el) {
    syncSelectionBox();
    return;
  }
  if (elementObserver) {
    elementObserver.disconnect();
    elementObserver = null;
  }
  selected = el;
  ensureSelectionChrome();
  syncSelectionBox();
  elementObserver = new ResizeObserver(() => syncSelectionBox());
  elementObserver.observe(el);
  send({
    type: 'live-select',
    tweakId: el.getAttribute(TWEAK_ATTR) ?? '',
    tagName: el.tagName.toLowerCase(),
    text: el.textContent?.slice(0, 200) || undefined,
    translate: el.style.translate || undefined,
    scale: el.style.scale || undefined,
  });
}

function clearSelection() {
  selected = null;
  clearSelectionUI();
  send({ type: 'live-clear-select' });
}

// ─── Drag (move) using CSS `translate` ──────────────────────────────────────

interface DragState {
  startX: number;
  startY: number;
  baseTx: number;
  baseTy: number;
}

let dragState: DragState | null = null;
let dragBeforeSnap: Map<string, ElementSnapshot> | null = null;

function parseTranslate(value: string): { x: number; y: number } {
  if (!value) return { x: 0, y: 0 };
  const m = value.match(/^(-?[\d.]+)px(?:\s+(-?[\d.]+)px)?$/);
  if (!m) return { x: 0, y: 0 };
  return { x: parseFloat(m[1]), y: m[2] ? parseFloat(m[2]) : 0 };
}

function beginDrag(el: HTMLElement, clientX: number, clientY: number) {
  const base = parseTranslate(el.style.translate);
  dragState = { startX: clientX, startY: clientY, baseTx: base.x, baseTy: base.y };
  dragBeforeSnap = beginOperation([el]);
  document.body.style.userSelect = 'none';
}

function applyDrag(clientX: number, clientY: number) {
  if (!dragState || !selected) return;
  const dx = clientX - dragState.startX;
  const dy = clientY - dragState.startY;
  const tx = dragState.baseTx + dx;
  const ty = dragState.baseTy + dy;
  selected.style.translate = `${tx}px ${ty}px`;
  syncSelectionBox();
}

function endDrag() {
  if (!dragState || !selected) {
    dragState = null;
    document.body.style.userSelect = '';
    return;
  }
  const el = selected;
  const before = dragBeforeSnap;
  dragState = null;
  dragBeforeSnap = null;
  document.body.style.userSelect = '';
  syncSelectionBox();
  const tid = el.getAttribute(TWEAK_ATTR);
  if (before && commitOperation(before, [el])) {
    if (tid) markDirty(tid, 'move');
    notifyChanges();
  }
  send({
    type: 'live-tweak-changed',
    tweakId: tid ?? '',
    translate: el.style.translate || undefined,
    scale: el.style.scale || undefined,
  });
}

// ─── Resize (scale) using CSS `scale` ───────────────────────────────────────

interface ScaleState {
  startX: number;
  baseScale: number;
  startWidth: number;
}

let scaleState: ScaleState | null = null;
let scaleBeforeSnap: Map<string, ElementSnapshot> | null = null;

function parseScale(value: string): number {
  if (!value) return 1;
  const m = value.match(/^(-?[\d.]+)$/);
  return m ? parseFloat(m[1]) : 1;
}

function beginScale(el: HTMLElement, clientX: number) {
  const baseScale = parseScale(el.style.scale);
  scaleState = { startX: clientX, baseScale, startWidth: el.getBoundingClientRect().width };
  scaleBeforeSnap = beginOperation([el]);
  document.body.style.userSelect = 'none';
}

function applyScale(clientX: number) {
  if (!scaleState || !selected) return;
  const dx = clientX - scaleState.startX;
  if (scaleState.startWidth <= 0) return;
  const ratio = (scaleState.startWidth + dx) / scaleState.startWidth;
  const next = Math.max(0.2, Math.min(5, scaleState.baseScale * ratio));
  selected.style.scale = next.toFixed(3);
  syncSelectionBox();
}

function endScale() {
  if (!scaleState || !selected) {
    scaleState = null;
    document.body.style.userSelect = '';
    return;
  }
  const el = selected;
  const before = scaleBeforeSnap;
  scaleState = null;
  scaleBeforeSnap = null;
  document.body.style.userSelect = '';
  syncSelectionBox();
  const tid = el.getAttribute(TWEAK_ATTR);
  if (before && commitOperation(before, [el])) {
    if (tid) markDirty(tid, 'scale');
    notifyChanges();
  }
  send({
    type: 'live-tweak-changed',
    tweakId: tid ?? '',
    translate: el.style.translate || undefined,
    scale: el.style.scale || undefined,
  });
}

// ─── Scale handle ───────────────────────────────────────────────────────────

function ensureScaleHandle(): HTMLDivElement {
  if (scaleHandle && scaleHandle.isConnected) return scaleHandle;
  const layer = ensureOverlayLayer();
  const handle = document.createElement('div');
  handle.setAttribute(CHROME_ATTR, '');
  handle.style.cssText = [
    'position:absolute',
    'width:12px',
    'height:12px',
    'background:#f78166',
    'border:2px solid #0d1117',
    'border-radius:3px',
    'pointer-events:auto',
    'cursor:nwse-resize',
    'z-index:2147483647',
  ].join(';');
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selected) return;
    beginScale(selected, e.clientX);
    const move = (ev: PointerEvent) => applyScale(ev.clientX);
    const up = () => {
      endScale();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  layer.appendChild(handle);
  scaleHandle = handle;
  return handle;
}

function syncScaleHandle() {
  if (!selected) {
    scaleHandle?.remove();
    scaleHandle = null;
    return;
  }
  const handle = ensureScaleHandle();
  const r = selected.getBoundingClientRect();
  handle.style.left = `${r.right - 6}px`;
  handle.style.top = `${r.bottom - 6}px`;
}

// ─── Inline text editing (contenteditable) ──────────────────────────────────
//
// Entering editing mode is an explicit signal: the element gets a bright
// outline + a small "editing" badge so the user knows Space/Arrows are now
// captured for text editing and won't trigger their deck's page-flip script.

let editingEl: HTMLElement | null = null;
let editingBeforeSnap: Map<string, ElementSnapshot> | null = null;

function beginInlineEdit(el: HTMLElement) {
  if (editingEl === el) return;
  if (editingEl) finishInlineEdit(true);
  editingEl = el;
  editingBeforeSnap = beginOperation([el]);
  el.setAttribute('contenteditable', 'true');
  el.focus();
  // Select all text on entry so typing replaces the content (common UX for
  // in-place rename/edit).
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  showEditingBadge();
  if (selectionOutline) {
    selectionOutline.style.borderColor = '#f78166';
    selectionOutline.style.borderWidth = '2px';
    selectionOutline.style.boxShadow = '0 0 0 3px rgba(247, 129, 102, 0.2)';
  }
}

function finishInlineEdit(commit: boolean) {
  if (!editingEl) return;
  const el = editingEl;
  const before = editingBeforeSnap;
  el.removeAttribute('contenteditable');
  hideEditingBadge();
  if (selectionOutline) {
    selectionOutline.style.borderColor = '#f78166';
    selectionOutline.style.borderWidth = '1.5px';
    selectionOutline.style.boxShadow = '';
  }
  if (!commit && before) {
    // Esc: roll back to the snapshot captured on edit-begin (cheaper than a
    // full undo entry, and we don't push anything onto the undo stack).
    restoreSnapshot(before);
    notifyChanges();
  } else if (commit && before) {
    // Commit: push a history entry so Cmd+Z can revert this edit.
    if (commitOperation(before, [el])) {
      const tid = el.getAttribute(TWEAK_ATTR);
      if (tid) markDirty(tid, 'text');
      notifyChanges();
    }
    send({ type: 'live-patched', bodyHtml: document.body.innerHTML });
  }
  editingEl = null;
  editingBeforeSnap = null;
  // Re-sync inspector with the committed/reverted text.
  send({
    type: 'live-select',
    tweakId: el.getAttribute(TWEAK_ATTR) ?? '',
    tagName: el.tagName.toLowerCase(),
    text: el.textContent?.slice(0, 200) || undefined,
    translate: el.style.translate || undefined,
    scale: el.style.scale || undefined,
  });
}

// ─── Editing badge ("editing" label at the top-left of the selection) ───────

function showEditingBadge() {
  if (!selected) return;
  if (editingBadge && editingBadge.isConnected) return;
  const layer = ensureOverlayLayer();
  const badge = document.createElement('div');
  badge.setAttribute(CHROME_ATTR, '');
  badge.textContent = 'editing';
  badge.style.cssText = [
    'position:absolute',
    'background:#f78166',
    'color:#0d1117',
    'font:600 10px/1.4 "JetBrains Mono", monospace',
    'padding:2px 6px',
    'border-radius:3px',
    'pointer-events:none',
    'z-index:2147483647',
    'letter-spacing:0.5px',
  ].join(';');
  layer.appendChild(badge);
  editingBadge = badge;
  syncEditingBadge();
}

function hideEditingBadge() {
  editingBadge?.remove();
  editingBadge = null;
}

function syncEditingBadge() {
  if (!editingBadge || !selected) return;
  const r = selected.getBoundingClientRect();
  editingBadge.style.left = `${r.left}px`;
  editingBadge.style.top = `${r.top - 20}px`;
}

// ─── Edit mode toggle ───────────────────────────────────────────────────────
//
// The workbench boots in BROWSE mode: pointer/keyboard events pass through to
// the user's document so they can view images, scroll, follow links, and
// trigger animations without any selection chrome getting in the way. The user
// must explicitly enable EDIT mode (via the host toolbar button) to start
// selecting / dragging / editing text.

let editMode = false;

function setEditMode(enabled: boolean) {
  if (editMode === enabled) return;
  editMode = enabled;
  if (!enabled) {
    // Leaving edit mode: abort any in-flight edit + drop the selection so no
    // orange chrome lingers over the document the user just wants to read.
    if (editingEl) finishInlineEdit(false);
    clearSelection();
  }
}

// ─── Click routing ──────────────────────────────────────────────────────────

function isChrome(el: Element): boolean {
  return !!el.closest(`[${CHROME_ATTR}]`);
}

function findTweakable(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  if (isChrome(target)) return null;
  return target.closest(`[${TWEAK_ATTR}]`) as HTMLElement | null;
}

interface PendingDrag {
  el: HTMLElement;
  startX: number;
  startY: number;
  active: boolean;
}
let pendingDrag: PendingDrag | null = null;
const DRAG_THRESHOLD = 3;

function onPointerDown(e: PointerEvent) {
  // Browse mode: never intercept. Lets the user click images, links, buttons
  // inside their HTML without us stamping a selection box on everything.
  if (!editMode) return;
  if (isChrome(e.target as Element)) return;
  // Clicking outside the editing element commits the edit first.
  if (editingEl) {
    const el = findTweakable(e.target);
    if (el !== editingEl) {
      finishInlineEdit(true);
    } else {
      // Click inside the editing element — let contenteditable handle it.
      return;
    }
  }
  const el = findTweakable(e.target);
  if (!el) {
    clearSelection();
    return;
  }
  selectElement(el);
  pendingDrag = { el, startX: e.clientX, startY: e.clientY, active: false };
  const move = (ev: PointerEvent) => {
    if (!pendingDrag) return;
    if (!pendingDrag.active) {
      const dx = Math.abs(ev.clientX - pendingDrag.startX);
      const dy = Math.abs(ev.clientY - pendingDrag.startY);
      if (dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
      pendingDrag.active = true;
      beginDrag(pendingDrag.el, pendingDrag.startX, pendingDrag.startY);
    }
    applyDrag(ev.clientX, ev.clientY);
  };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    if (pendingDrag?.active) endDrag();
    pendingDrag = null;
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

function onDblClick(e: MouseEvent) {
  if (!editMode) return;
  const el = findTweakable(e.target);
  if (!el) return;
  e.preventDefault();
  selectElement(el);
  beginInlineEdit(el);
}

// ─── Keyboard handling ──────────────────────────────────────────────────────
//
// Two modes:
//   • Browse mode (not editing): Space/Arrows pass through to user scripts so
//     deck page-flip / animation triggers keep working. Cmd/Ctrl+Z triggers
//     our undo. Esc clears selection.
//   • Editing mode: Space/Arrows/Tab/Enter are captured on the capture phase
//     so they edit text instead of flipping pages. Esc discards, Cmd/Ctrl+Enter
//     commits. Cmd/Ctrl+Z inside editing mode uses the browser's native
//     contenteditable undo (we don't intercept it).

const EDITING_INTERCEPT_KEYS = new Set([
  ' ', 'Spacebar', 'Space',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Tab', 'Enter',
]);

function isUndoShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z');
}

function isRedoShortcut(e: KeyboardEvent): boolean {
  return ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'z' || e.key === 'Z'))
    || ((e.metaKey || e.ctrlKey) && e.key === 'y');
}

function isCommitShortcut(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key === 'Enter';
}

function onKeydown(e: KeyboardEvent) {
  // Undo/Redo shortcuts work in both modes (in editing mode, let the browser
  // handle native contenteditable undo unless our stack is the one that should
  // roll back the whole edit commit).
  if (isUndoShortcut(e)) {
    if (editingEl) {
      // Inside editing mode: defer to native contenteditable undo for
      // character-level edits. Our stack entry is only pushed on commit.
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    undo();
    return;
  }
  if (isRedoShortcut(e)) {
    if (editingEl) return;
    e.preventDefault();
    e.stopPropagation();
    redo();
    return;
  }

  if (editingEl) {
    // Editing mode: intercept keys that would otherwise bubble to the user's
    // page-flip / animation scripts. We stop propagation so the user's
    // document-level listeners never see them, but we do NOT preventDefault
    // (except for Tab) so contenteditable keeps working normally.
    if (EDITING_INTERCEPT_KEYS.has(e.key) || e.code === 'Space') {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '\t');
      } else if (e.key === 'Enter' && !e.shiftKey && !isCommitShortcut(e)) {
        // Plain Enter: let contenteditable insert a newline (don't commit).
        // We already stopPropagation above so the deck won't flip pages.
      }
      return;
    }
    if (isCommitShortcut(e)) {
      e.preventDefault();
      e.stopPropagation();
      finishInlineEdit(true);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finishInlineEdit(false);
      return;
    }
    return;
  }

  // Browse mode: let everything through except Esc (clears selection) and our
  // undo/redo shortcuts (already handled above).
  if (e.key === 'Escape') {
    clearSelection();
  }
}

// ─── Reset helpers ──────────────────────────────────────────────────────────

function resetTweak(tweakId: string) {
  const el = elementCache.get(tweakId);
  if (!el) return;
  const before = beginOperation([el]);
  el.style.translate = '';
  el.style.scale = '';
  if (commitOperation(before, [el])) {
    recomputeDirty(before);
    notifyChanges();
  }
  if (selected === el) syncSelectionBox();
  send({ type: 'live-tweak-changed', tweakId, translate: undefined, scale: undefined });
}

function resetAllTweaks() {
  const els = Array.from(elementCache.values());
  const before = beginOperation(els);
  els.forEach((el) => {
    el.style.translate = '';
    el.style.scale = '';
  });
  if (commitOperation(before, els)) {
    recomputeDirty(before);
    notifyChanges();
  }
  if (selected) syncSelectionBox();
  send({ type: 'live-tweak-changed', tweakId: '*', translate: undefined, scale: undefined });
}

// ─── Focus element (change-list click) ──────────────────────────────────────

function focusElement(tweakId: string) {
  const el = elementCache.get(tweakId);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Brief flash highlight so the user spots the element even in browse mode.
  const r = el.getBoundingClientRect();
  const layer = ensureOverlayLayer();
  const flash = document.createElement('div');
  flash.setAttribute(CHROME_ATTR, '');
  flash.style.cssText = [
    'position:fixed',
    `left:${r.left}px`,
    `top:${r.top}px`,
    `width:${r.width}px`,
    `height:${r.height}px`,
    'border:2px solid #f78166',
    'box-shadow:0 0 0 4px rgba(247,129,102,0.3)',
    'pointer-events:none',
    'z-index:2147483647',
    'transition:opacity .5s ease',
  ].join(';');
  layer.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; }, 700);
  setTimeout(() => flash.remove(), 1300);
  // In edit mode, also select the element so the user can immediately tweak it.
  if (editMode) selectElement(el);
}

// ─── Text search (TreeWalker + Selection API, no DOM mutation) ──────────────

interface SearchMatch {
  node: Text;
  start: number;
  end: number;
}

let searchMatches: SearchMatch[] = [];
let searchIndex = -1;

function runSearch(query: string) {
  searchMatches = [];
  searchIndex = -1;
  const lower = query.toLowerCase();
  if (lower) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || !node.textContent) return NodeFilter.FILTER_REJECT;
        if (isChrome(p) || p.closest('script,style,noscript,template')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent || '';
      let idx = text.toLowerCase().indexOf(lower);
      while (idx >= 0) {
        searchMatches.push({ node: walker.currentNode as Text, start: idx, end: idx + query.length });
        idx = text.toLowerCase().indexOf(lower, idx + lower.length);
      }
    }
  }
  if (searchMatches.length > 0) {
    searchIndex = 0;
    showSearchMatch();
  } else {
    window.getSelection()?.removeAllRanges();
  }
  send({ type: 'live-search-result', total: searchMatches.length, current: searchIndex + 1 });
}

function gotoSearchMatch(direction: 'next' | 'prev') {
  if (searchMatches.length === 0) return;
  if (direction === 'next') {
    searchIndex = (searchIndex + 1) % searchMatches.length;
  } else {
    searchIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
  }
  showSearchMatch();
  send({ type: 'live-search-result', total: searchMatches.length, current: searchIndex + 1 });
}

function showSearchMatch() {
  if (searchIndex < 0 || searchIndex >= searchMatches.length) return;
  const m = searchMatches[searchIndex];
  const range = document.createRange();
  range.setStart(m.node, m.start);
  range.setEnd(m.node, m.end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
  m.node.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ─── Page detection: intentionally NOT implemented ──────────────────────────
//
// HTML decks flip pages via three incompatible mechanisms — scroll, transform
// translate, or visibility/opacity toggles — and every framework (reveal.js,
// impress.js, Slidev, hand-rolled) drives them from its own JS. A heuristic
// based on scroll position or element visibility returns wrong numbers for the
// majority of decks, and a wrong page indicator is worse than none. We
// deliberately omit page detection rather than ship a misleading one.

// ─── Serialization for export ───────────────────────────────────────────────

function serializeForExport(): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(`[${CHROME_ATTR}]`).forEach((n) => n.remove());
  clone.querySelectorAll(`[${TWEAK_ATTR}]`).forEach((el) => el.removeAttribute(TWEAK_ATTR));
  clone.querySelectorAll('[data-hds-shim]').forEach((n) => n.remove());
  clone.querySelectorAll('script[data-hds-runtime]').forEach((n) => n.remove());
  const docType = document.doctype ? '<!doctype html>\n' : '';
  return docType + clone.outerHTML;
}

// ─── Message handling ───────────────────────────────────────────────────────

function onMessage(evt: MessageEvent) {
  if (evt.source !== TARGET) return;
  const msg = evt.data as LiveHostMessage;
  if (!msg || typeof msg.type !== 'string') return;
  try {
    switch (msg.type) {
      case 'live-request-html':
        send({ type: 'live-response-html', html: serializeForExport() });
        break;
      case 'live-reset-tweak':
        resetTweak(msg.tweakId);
        break;
      case 'live-reset-all':
        resetAllTweaks();
        break;
      case 'live-undo':
        undo();
        break;
      case 'live-redo':
        redo();
        break;
      case 'live-set-edit-mode':
        setEditMode(msg.enabled);
        break;
      case 'live-focus-element':
        focusElement(msg.tweakId);
        break;
      case 'live-search':
        if (msg.action === 'run') runSearch(msg.query);
        else gotoSearchMatch(msg.action);
        break;
    }
  } catch (err) {
    send({ type: 'live-error', code: 'message-handler', message: String(err) });
  }
}

// ─── Viewport listeners ─────────────────────────────────────────────────────

function attachViewportListeners() {
  window.addEventListener('scroll', () => syncSelectionBox(), { passive: true });
  window.addEventListener('resize', () => syncSelectionBox());
}

// ─── Boot ───────────────────────────────────────────────────────────────────

function boot() {
  requestAnimationFrame(() => {
    stampTweakIds();
    attachViewportListeners();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('dblclick', onDblClick, true);
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('message', onMessage);
    send({ type: 'live-ready' });
    notifyHistory();
    notifyChanges();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
