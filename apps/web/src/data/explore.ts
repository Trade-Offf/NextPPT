/**
 * "Explore" articles — long-form pieces about AI content workflows that are NOT
 * editable-in-NextPPT templates. Each article has its own route
 * (`/explore/<slug>`) and renders as a read-first article, not a template card.
 *
 * Card title/desc and article body text live in the `explore` i18n namespace,
 * keyed by `slug` under `items.<slug>` / `article` (single-article for now).
 */
export interface ExploreItem {
  /** Stable slug; route segment + i18n key under explore.items.<slug>. */
  slug: string;
  /** Cover image (also used as the article hero). */
  cover: string;
  /** Optional downloadable sample (e.g. a ready-made .drawio). */
  drawioUrl?: string;
  /** Short labels (not translated; keep generic/short). */
  tags: string[];
}

export const EXPLORE: ExploreItem[] = [
  {
    slug: 'feishu-whiteboard',
    cover: '/feishu-whiteboard-demo.jpg',
    drawioUrl: '/ai-svg-feishu-note.drawio',
    tags: ['Lark', 'drawio', 'SVG'],
  },
];

export function findArticle(slug: string | undefined): ExploreItem | undefined {
  return EXPLORE.find((a) => a.slug === slug);
}
