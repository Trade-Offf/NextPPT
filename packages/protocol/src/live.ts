/**
 * postMessage protocol for the HTML workbench live-runtime.
 *
 * The workbench preserves the user's original <script> tags (so animations and
 * interactions stay live). Visual tweaks (move/scale) are layered on top via
 * the independent CSS `translate` / `scale` properties, which never overwrite
 * the original `transform`. Text edits use contenteditable.
 *
 * Messages are kept independent from the deck editor protocol so the two
 * runtimes never cross wires.
 */

// ─── Host → Runtime ─────────────────────────────────────────────────────────

export type LiveHostMessage =
  | LiveRequestHtmlMessage
  | LiveResetTweakMessage
  | LiveResetAllMessage
  | LiveUndoMessage
  | LiveRedoMessage
  | LiveSetEditModeMessage
  | LiveFocusElementMessage
  | LiveSearchMessage;

/** Request the current serialized full document HTML (text edits + tweaks applied). */
export interface LiveRequestHtmlMessage {
  type: 'live-request-html';
}

/** Reset a single element's visual override (translate/scale). */
export interface LiveResetTweakMessage {
  type: 'live-reset-tweak';
  tweakId: string;
}

/** Reset every element's visual override. */
export interface LiveResetAllMessage {
  type: 'live-reset-all';
}

/** Undo the last operation (text edit, drag, scale, reset). */
export interface LiveUndoMessage {
  type: 'live-undo';
}

/** Redo the last undone operation. */
export interface LiveRedoMessage {
  type: 'live-redo';
}

/** Toggle edit mode on/off. In browse mode the runtime lets all pointer/keyboard
 *  events pass through to the user's scripts (so the user can view images,
 *  scroll, trigger animations). In edit mode it selects on click, edits on
 *  double-click, and drags/scales the selection. */
export interface LiveSetEditModeMessage {
  type: 'live-set-edit-mode';
  enabled: boolean;
}

/** Scroll a specific element into view + flash-highlight it. Used by the
 *  change-list panel so the user can jump to a modified element. */
export interface LiveFocusElementMessage {
  type: 'live-focus-element';
  tweakId: string;
}

/** Run or navigate a text search inside the document. `action: 'run'` starts a
 *  fresh search for `query`; `'next'` / `'prev'` jump between matches of the
 *  last query. Matches are found via TreeWalker (no DOM mutation) and
 *  highlighted using the native Selection API. */
export interface LiveSearchMessage {
  type: 'live-search';
  query: string;
  action: 'run' | 'next' | 'prev';
}

// ─── Runtime → Host ─────────────────────────────────────────────────────────

export type LiveRuntimeMessage =
  | LiveReadyMessage
  | LiveSelectMessage
  | LiveClearSelectMessage
  | LivePatchedMessage
  | LiveResponseHtmlMessage
  | LiveTweakChangedMessage
  | LiveErrorMessage
  | LiveHistoryChangedMessage
  | LiveChangesUpdatedMessage
  | LiveSearchResultMessage;

export interface LiveReadyMessage {
  type: 'live-ready';
}

export interface LiveSelectMessage {
  type: 'live-select';
  /** Stable id stamped on the element when the runtime booted. */
  tweakId: string;
  tagName: string;
  text?: string;
  /** Current visual override, if any. */
  translate?: string;
  scale?: string;
}

export interface LiveClearSelectMessage {
  type: 'live-clear-select';
}

/** Emitted after a contenteditable text edit is committed. */
export interface LivePatchedMessage {
  type: 'live-patched';
  /** Full <body> innerHTML after patch (text edits live on the DOM directly). */
  bodyHtml: string;
}

export interface LiveResponseHtmlMessage {
  type: 'live-response-html';
  /** Full document HTML (<!doctype …</html>) with text edits + tweak inline styles. */
  html: string;
}

/** Emitted whenever an element's visual override changes (drag/scale/reset). */
export interface LiveTweakChangedMessage {
  type: 'live-tweak-changed';
  tweakId: string;
  translate?: string;
  scale?: string;
}

export interface LiveErrorMessage {
  type: 'live-error';
  code: string;
  message: string;
}

/** Emitted whenever the undo/redo stack changes so the host can update its
 *  button enabled/disabled state. */
export interface LiveHistoryChangedMessage {
  type: 'live-history-changed';
  canUndo: boolean;
  canRedo: boolean;
}

/** Emitted whenever the set of modified elements changes (after a commit,
 *  undo, redo, or reset). The host renders this as a clickable change list. */
export interface LiveChangesUpdatedMessage {
  type: 'live-changes-updated';
  changes: ChangeSummary[];
}

export interface ChangeSummary {
  tweakId: string;
  tagName: string;
  /** What changed — any combination of 'text', 'move', 'scale'. */
  kinds: string[];
  /** Short text preview (truncated textContent) for display. */
  preview: string;
}

/** Emitted after a search run or navigation. `current` is 1-based (0 when no
 *  match is active). */
export interface LiveSearchResultMessage {
  type: 'live-search-result';
  total: number;
  current: number;
}

// ─── Page detection: intentionally omitted ──────────────────────────────────
// HTML decks flip pages via scroll / transform / visibility, each driven by
// framework-specific JS. A scroll-based heuristic returns wrong numbers for
// the majority of decks, and a wrong indicator is worse than none.
