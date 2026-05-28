import { create } from 'zustand';
import type { DeckMeta, SlideEntry } from '@hds/protocol';
import type { StyleSnapshot } from '@hds/protocol';

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
}

export interface DeckStore {
  // ── File system ──────────────────────────────────────────
  dirHandle: FileSystemDirectoryHandle | null;
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
  closeDirectory: () => void;

  setSlides: (slides: SlideState[]) => void;
  updateSlideHtml: (id: string, html: string) => void;
  setThumbnail: (id: string, thumbnail: string) => void;

  setCurrentSlide: (id: string) => void;
  setSelection: (sel: SelectionState | null) => void;
  setViewMode: (mode: 'visual' | 'code') => void;

  setRawHtml: (html: string) => void;
  markDirty: () => void;
  markSaving: () => void;
  markSaved: () => void;
}

export const useDeckStore = create<DeckStore>((set) => ({
  dirHandle: null,
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
    set({ dirHandle: handle, sourceFileName: fileName, deckFileName: copyName, rawHtml: html, headHtml, meta, slides, currentSlideId: slides[0]?.id ?? null, isDirty: false });
  },

  closeDirectory: () =>
    set({ dirHandle: null, sourceFileName: '', deckFileName: '', rawHtml: '', headHtml: '', meta: null, slides: [], currentSlideId: null, selection: null, isDirty: false }),

  setSlides: (slides) => set({ slides }),

  updateSlideHtml: (id, html) =>
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, html } : sl)), isDirty: true })),

  setThumbnail: (id, thumbnail) =>
    set((s) => ({ slides: s.slides.map((sl) => (sl.id === id ? { ...sl, thumbnail } : sl)) })),

  setCurrentSlide: (id) => set({ currentSlideId: id, selection: null }),

  setSelection: (selection) => set({ selection }),

  setViewMode: (viewMode) => set({ viewMode }),

  setRawHtml: (rawHtml) => set({ rawHtml }),

  markDirty: () => set({ isDirty: true }),
  markSaving: () => set({ isSaving: true }),
  markSaved: () => set({ isSaving: false, isDirty: false, lastSavedAt: Date.now() }),
}));
