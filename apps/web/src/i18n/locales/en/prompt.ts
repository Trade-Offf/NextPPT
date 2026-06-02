import type zh from '../zh/prompt.js';

const prompt: typeof zh = {
  topic: '[your topic here]',
  generate: `You are a senior presentation designer and front-end engineer. Generate a single-file HTML slide deck, ready to present, on the topic "{{topic}}".

[Most important output requirements]
- Output only one complete .html file in full, from <!doctype html> through </html>.
- No explanations, preamble or closing remarks, and do not wrap it in \`\`\` code fences.

[Document structure (must follow strictly)]
1. The top level is a complete HTML document: <!doctype html><html lang="en"><head> … </head><body> … </body></html>.
2. <head> must contain:
   - <meta charset="UTF-8" />
   - <title>a one-line summary of the topic</title> (this becomes the deck title)
   - one <style> tag holding all styles (do not link external CSS files).
3. Every slide is a <section class="slide"> … </section>, placed directly as children of <body> in order.
   - The class must contain exactly slide (the parser only recognizes section.slide).

[Size and styling (must follow strictly)]
- Each .slide is strictly 16:9: width: 1280px; height: 720px; box-sizing: border-box; overflow: hidden; position: relative.
- Lay out content within this fixed 1280×720 canvas using flex/grid; nothing should overflow.
- Define colors, fonts and spacing in the <style> in head; you may @import Google Fonts or use a system font stack.
- Carry all text in semantic tags: h1/h2/h3 for headings, p for body, ul>li for bullets, span/strong for emphasis — so the user can click to edit text in the editor.

[Asset constraints (must follow strictly)]
- Do not use any relative-path assets (e.g. ./img.png, assets/x.svg) — the file must open standalone outside any folder.
- For graphics, use only: inline <svg>, data: URIs (base64-embedded images), or absolute publicly reachable CDN links (https://…).

[Content requirements]
- Produce 6–10 pages, suggested structure: cover → agenda/overview → 3–6 core pages (one idea each, with bullets or a diagram) → closing page (summary / call to action).
- Write in English, professional, concise and substantive — avoid filler.
- Keep the visual style modern and restrained, with consistent colors and typographic rhythm; use gradients, cards and icons in moderation to add hierarchy.

Now output the full .html file directly.`,
};

export default prompt;
