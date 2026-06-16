import { describe, it, expect } from 'vitest';
import { normalizeDeck } from './normalizeDeck.js';
import { parseDeck, rebuildDeckHtml, deckSlideCount } from './adapter.js';

function page(inner: string, attrs = ''): string {
  return `<div class="page" ${attrs}>${inner}</div>`;
}

const wrap = (body: string, head = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('normalizeDeck — detection & strategy', () => {
  it('native section.slide is left untouched', () => {
    const html = wrap('<section class="slide">a</section><section class="slide p2">b</section>');
    const r = normalizeDeck(html);
    expect(r.strategy).toBe('native');
    expect(r.slideCount).toBe(2);
    expect(r.confidence).toBe('high');
    expect(r.html).toBe(html);
  });

  it('div.slide is normalized (high confidence)', () => {
    const r = normalizeDeck(wrap('<div class="slide">a</div><div class="slide">b</div>'));
    expect(r.strategy).toBe('div-slide');
    expect(r.slideCount).toBe(2);
    expect(r.confidence).toBe('high');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('.pptx-slide / .slide-page are high confidence', () => {
    const r = normalizeDeck(wrap('<div class="pptx-slide">a</div><div class="pptx-slide">b</div>'));
    expect(r.strategy).toBe('slide-page');
    expect(r.confidence).toBe('high');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('bare <section> children of body (low confidence)', () => {
    const r = normalizeDeck(wrap('<section><h1>a</h1></section><section><h1>b</h1></section>'));
    expect(r.strategy).toBe('bare-section');
    expect(r.confidence).toBe('low');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('.page containers default to low confidence (A4-like docs)', () => {
    const r = normalizeDeck(wrap(`${page('<h1>a</h1>')}${page('<h1>b</h1>')}${page('<h1>c</h1>')}`));
    expect(r.strategy).toBe('page-class');
    expect(r.confidence).toBe('low');
    expect(deckSlideCount(r.html)).toBe(3);
  });

  it('.page with inline 16:9 size is promoted to high confidence', () => {
    const styled = (i: string) => page(i, 'style="width:1280px;height:720px"');
    const r = normalizeDeck(wrap(`${styled('<h1>a</h1>')}${styled('<h1>b</h1>')}`));
    expect(r.strategy).toBe('page-class');
    expect(r.confidence).toBe('high');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('[data-slide] markers (high confidence)', () => {
    const r = normalizeDeck(wrap('<article data-slide><p>a</p></article><article data-slide><p>b</p></article>'));
    expect(r.strategy).toBe('data-slide');
    expect(r.confidence).toBe('high');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('reveal.js structure (high confidence)', () => {
    const r = normalizeDeck(
      wrap('<div class="reveal"><div class="slides"><section><h1>a</h1></section><section><h1>b</h1></section></div></div>'),
    );
    expect(r.strategy).toBe('reveal');
    expect(r.confidence).toBe('high');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('equal sibling blocks heuristic (low confidence)', () => {
    const r = normalizeDeck(
      wrap('<main><div><h1>a</h1><p>x</p></div><div><h1>b</h1><p>y</p></div></main>'),
    );
    expect(r.strategy).toBe('siblings');
    expect(r.confidence).toBe('low');
    expect(deckSlideCount(r.html)).toBe(2);
  });

  it('continuous flowing content → none', () => {
    const r = normalizeDeck(wrap('<h1>Title</h1><p>one</p><p>two</p><ul><li>x</li></ul>'));
    expect(r.strategy).toBe('none');
    expect(r.slideCount).toBe(0);
    expect(r.confidence).toBe('low');
  });
});

describe('normalizeDeck — parseDeck round-trip', () => {
  it('normalized div.slide parses and rebuilds to the same page count', () => {
    const { html } = normalizeDeck(wrap('<div class="slide">a</div><div class="slide">b</div><div class="slide">c</div>'));
    const { slides } = parseDeck(html);
    expect(slides).toHaveLength(3);
    const rebuilt = rebuildDeckHtml(html, slides);
    expect(deckSlideCount(rebuilt)).toBe(3);
  });

  it('does not double-wrap nested matches', () => {
    // Outer .page wraps inner .slide; only the outermost becomes a page.
    const r = normalizeDeck(wrap('<div class="page"><div class="slide">x</div></div>'));
    expect(r.slideCount).toBe(1);
    expect(deckSlideCount(r.html)).toBe(1);
  });
});
