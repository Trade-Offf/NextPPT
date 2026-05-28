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
