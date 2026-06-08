/**
 * HDS Slide Protocol v1
 * Core types for deck / slide structure shared across web and api.
 */

export interface DeckMeta {
  version: 1;
  title?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  slides: SlideEntry[];
  assets: AssetEntry[];
}

export interface SlideEntry {
  /** ULID – stable identifier, written to data-page-id */
  id: string;
  /** 1-based display ordinal */
  ordinal: number;
  chapter?: string;
}

export interface AssetEntry {
  /** Relative path from deck root, e.g. "assets/16-1.png" */
  path: string;
  sha1: string;
}

/** HDS requires each slide to be a <section class="slide"> at 1280×720 */
export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;
/** Matches <section class="slide"> and <section class="slide p1 ..."> */
export const SLIDE_SELECTOR = 'section[class~="slide"]';

/**
 * Workspace kind.
 * - `deck`: the classic slide deck — many `<section class="slide">` pages,
 *   per-page editing and per-page PPTX/PDF export.
 * - `doc`: free-edit mode — any HTML treated as one editable, scrollable
 *   document; exported via smart pagination (vector PDF / PNG).
 */
export type WorkspaceKind = 'deck' | 'doc';

/** Attribute marking the single root container used in `doc` (free-edit) mode. */
export const DOC_ROOT_ATTR = 'data-hds-doc';
/** Selector for the `doc` mode root container. */
export const DOC_SELECTOR = '[data-hds-doc]';
