export interface ExploreItem {
  slug: string;
  cover: string;
  drawioUrl?: string;
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
