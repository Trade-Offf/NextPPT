import { create } from 'zustand';
import type { DeckMeta, SlideEntry } from '@hds/protocol';
import type { StyleSnapshot } from '@hds/protocol';
import { ulid } from '../lib/ulid.js';

export interface SlideState extends SlideEntry {
  /** Serialised outer HTML of <section class="slide"> */
  html: string;
  /** Data-URL thumbnail (generated after first render) */
  thumbnail: string | null;
}

export interface SelectionState {
  selector: string;
  tagName: string;
  bbox: DOMRect;
  styleSnapshot: StyleSnapshot;
  attrs?: Record<string, string>;
}

export interface DeckStore {
  // ── File system ──────────────────────────────────────────
  /** Folder mode: the opened directory handle. Null in single-file mode. */
  dirHandle: FileSystemDirectoryHandle | null;
  /** Single-file mode: the working-copy file handle (acquired on first save). */
  fileHandle: FileSystemFileHandle | null;
  /** 'folder' = directory picker, 'file' = single self-contained HTML. */
  mode: 'folder' | 'file';
  /** Immutable source filename (never written to) */
  sourceFileName: string;
  /** Working copy filename (written on save, defaults to source + '-hds') */
  deckFileName: string;
  rawHtml: string; // full deck HTML string

  // ── Parsed deck ──────────────────────────────────────────
  /** Serialised <head> content from the original document (styles, fonts) */
  headHtml: string;
  meta: DeckMeta | null;
  slides: SlideState[];

  // ── Editor state ─────────────────────────────────────────
  currentSlideId: string | null;
  selection: SelectionState | null;
  viewMode: 'visual' | 'code';

  // ── Save state ───────────────────────────────────────────
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;

  // ── Actions ──────────────────────────────────────────────
  openDirectory: (handle: FileSystemDirectoryHandle, fileName: string, html: string, headHtml: string, meta: DeckMeta, slides: SlideState[]) => void;
  openFile: (fileName: string, html: string, headHtml: string, meta: DeckMeta, slides: SlideState[]) => void;
  setWorkingFileHandle: (fh: FileSystemFileHandle) => void;
  closeDirectory: () => void;

  setSlides: (slides: SlideState[]) => void;
  updateSlideHtml: (id: string, html: string) => void;
  setThumbnail: (id: string, thumbnail: string) => void;

  // Page-level operations (F-09)
  duplicateSlide: (id: string) => void;
  deleteSlide: (id: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;

  setCurrentSlide: (id: string) => void;
  setSelection: (sel: SelectionState | null) => void;
  setViewMode: (mode: 'visual' | 'code') => void;

  setRawHtml: (html: string) => void;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
}

/** Set attributes on the root <section> of a serialized slide html string. */
function setRootAttrs(html: string, attrs: Record<string, string>): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const sec = doc.body.firstElementChild;
  if (!sec) return html;
  for (const [k, v] of Object.entries(attrs)) sec.setAttribute(k, v);
  return sec.outerHTML;
}

/** Re-assign data-page ordinals (1-based) to match array order. */
function renumber(slides: SlideState[]): SlideState[] {
  return slides.map((sl, idx) => {
    const ordinal = idx + 1;
    return { ...sl, ordinal, html: setRootAttrs(sl.html, { 'data-page': String(ordinal) }) };
  });
}

export const useDeckStore = create<DeckStore>((set) => ({
  dirHandle: null,
  fileHandle: null,
  mode: 'folder',
  sourceFileName: '',
  deckFileName: '',
  rawHtml: '',
  headHtml: '',
  meta: null,
  slides: [],
  currentSlideId: null,
  selection: null,
  viewMode: 'visual',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  openDirectory: (handle, fileName, html, headHtml, meta, slides) => {
    // Derive working-copy filename: foo.html → foo-hds.html
    const copyName = fileName.replace(/\.html$/i, '-hds.html');
    set({ dirHandle: handle, fileHandle: null, mode: 'folder', sourceFileName: fileName, deckFileName: copyName, rawHtml: html, headHtml, meta, slides, currentSlideId: slides[0]?.id ?? null, isDirty: false });
  },

  openFile: (fileName, html, headHtml, meta, slides) => {
    const copyName = fileName.replace(/\.html?$/i, '-hds.html');
    set({ dirHandle: null, fileHandle: null, mode: 'file', sourceFileName: fileName, deckFileName: copyName, rawHtml: html, headHtml, meta, slides, currentSlideId: slides[0]?.id ?? null, isDirty: false });
  },

  setWorkingFileHandle: (fh) => set({ fileHandle: fh }),

  closeDirectory: () =>
    set({ dirHandle: null, fileHandle: null, mode: 'folder', sourceFileName: '', deckFileName: '', rawHtml: '', headHtml: '', meta: null, slides: [], currentSlideId: null, selection: null, isDirty: false }),

  setSlides: (slides) => set({ slides }),

  updateSlideHtml: (id, html) =>
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, html } : sl)), isDirty: true })),

  setThumbnail: (id, thumbnail) =>
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, thumbnail } : sl)) })),

  duplicateSlide: (id) =>
    set((s) => {
      const idx = s.slides.findIndex((sl) => sl.id === id);
      if (idx < 0) return {};
      const src = s.slides[idx]!;
      const newId = ulid();
      const clone: SlideState = {
        ...src,
        id: newId,
        thumbnail: null,
        html: setRootAttrs(src.html, { 'data-page-id': newId }),
      };
      const next = [...s.slides.slice(0, idx + 1), clone, ...s.slides.slice(idx + 1)];
      return { slides: renumber(next), currentSlideId: newId, selection: null, isDirty: true };
    }),

  deleteSlide: (id) =>
    set((s) => {
      if (s.slides.length <= 1) return {}; // never delete the last slide
      const idx = s.slides.findIndex((sl) => sl.id === id);
      if (idx < 0) return {};
      const next = renumber(s.slides.filter((sl) => sl.id !== id));
      const current = s.currentSlideId === id
        ? next[Math.min(idx, next.length - 1)]?.id ?? null
        : s.currentSlideId;
      return { slides: next, currentSlideId: current, selection: null, isDirty: true };
    }),

  reorderSlides: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex === toIndex) return {};
      const arr = [...s.slides];
      const moved = arr.splice(fromIndex, 1)[0];
      if (!moved) return {};
      arr.splice(toIndex, 0, moved);
      return { slides: renumber(arr), isDirty: true };
    }),

  setCurrentSlide: (id) => set({ currentSlideId: id, selection: null }),

  setSelection: (selection) => set({ selection }),

  setViewMode: (viewMode) => set({ viewMode }),

  setRawHtml: (rawHtml) => set({ rawHtml }),

  markDirty: () => set({ isDirty: true }),
  markSaving: () => set({ isSaving: true }),
  markSaved: () => set({ isSaving: false, isDirty: false, lastSavedAt: Date.now() }),
}));
