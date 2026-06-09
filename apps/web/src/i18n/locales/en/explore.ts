import type zh from '../zh/explore.js';

const explore: typeof zh = {
  hero: {
    eyebrow: 'Explore',
    title: 'New moves worth trying in the AI workflow',
    subtitle:
      'A small collection of AI content workflows we have tried and found interesting — not templates, but ideas. Read it and you can run it.',
    back: 'Back to home',
  },
  readMore: 'Read more',
  items: {
    'feishu-whiteboard': {
      title: 'AI-generated Draw.io, editable in a Lark whiteboard',
      desc: 'Have AI emit a Draw.io file directly; import it into a Lark / Feishu whiteboard and every text, card and arrow becomes individually editable, comment-able and collaborative — turning an AI image from a frozen picture into a board you can keep refining.',
    },
  },
  article: {
    back: 'Back to Explore',
    cover: 'The real result after importing into a Lark / Feishu whiteboard: every element can be individually selected, dragged, edited, commented on and collaborated on.',
    lead: 'We recently validated a new AI design workflow: have AI generate a Draw.io file directly, then import it into a Lark whiteboard to get an editable infographic / flowchart / knowledge card. From now on AI does not only generate images or slides — it can generate an importable, editable, collaborative board file.',
    how: {
      title: 'How it works',
      intro: 'The core flow is simple:',
      steps: [
        'Hand an article, meeting notes, product plan or tech doc to AI;',
        'Ask AI to output Draw.io XML source;',
        'Save it as a .drawio file;',
        'Upload via "Import" inside a Lark whiteboard;',
        'After import, the text, cards, arrows and flow nodes stay editable.',
      ],
    },
    flow: {
      title: 'See it at a glance',
      caption: 'From a block of text to a collaborative board — the whole chain is just four steps.',
      nodes: {
        content: 'Content',
        contentSub: 'article / meeting / plan',
        ai: 'AI output',
        aiSub: 'Draw.io XML',
        file: 'Save .drawio',
        fileSub: 'local file',
        board: 'Import to whiteboard',
        boardSub: 'vector, splittable',
        editable: 'Editable',
        collab: 'Collaborative',
        reuse: 'Reusable',
      },
    },
    value: {
      title: 'Why it matters',
      intro: 'Compared with letting AI just output an image, this fits team collaboration far better:',
      items: [
        'Editable: not a frozen image — text and modules can all change;',
        'Collaborative: comment and adjust right inside the Lark whiteboard;',
        'Reusable: the same structure carries over to plan / architecture / summary diagrams;',
        'Visual: turns long text into an easier-to-grasp infographic;',
        'Low-cost: produce structured diagrams fast without opening a design tool.',
      ],
    },
    scenes: {
      title: 'Where it fits',
      items: [
        'Meeting notes → one summary diagram',
        'Product plan → flowchart / feature architecture',
        'Tech doc → system architecture / module map',
        'Competitive analysis → comparison chart',
        'Article / report → a visual long-form graphic',
        'Project retro → timeline / root-cause map',
        'Training material → knowledge cards',
      ],
    },
    future: {
      title: 'Wired to Lark CLI, it becomes a general capability',
      body: 'For now you still save the .drawio and import it by hand. Once wired to the Lark CLI / open platform, it upgrades from "generate a file once" into a team-wide capability: read a doc → distill structure → generate a board → write it into a designated Lark space → the team edits and collaborates directly.',
      quote: 'Any structured content can be auto-turned by AI into an editable Lark whiteboard.',
    },
    prompt: {
      title: 'The key prompt',
      hint: 'Expand to see the full prompt, then paste your content at the end.',
      copy: 'Copy prompt',
      copied: 'Copied',
      expand: 'Expand',
      collapse: 'Collapse',
      body: `Based on the content below, generate a Draw.io file that can be imported into a Lark whiteboard.

Requirements:
1. Output the complete .drawio XML source only — no SVG, PNG or HTML.
2. Aspect ratio 16:9, recommended size 1400 x 900.
3. Make it an information-visualization board, not plain text layout.
4. Use native Draw.io shapes wherever possible: text boxes, rounded rectangles, arrows, labels, group cards, flow nodes.
5. Ensure that after importing into a Lark whiteboard the text, cards, arrows and color blocks can be edited individually.
6. Visual style: professional, modern, suited to knowledge sharing — light background, card-based layout, clear hierarchy, moderate use of blue / purple / orange accents, no over-decoration.
7. Suggested structure: main title, subtitle, core idea, workflow flowchart, key scenarios, one-line summary.
8. Keep copy concise and insightful; do not cram it full of text.
9. The XML must be complete and importable into diagrams.net or a Lark whiteboard as a .drawio file.
10. Do not explain the process; output the XML source only.

Content:
[Paste your notes, article, meeting minutes or topic here]`,
    },
    download: 'Download sample drawio',
    summary: {
      title: 'In one line',
      body: 'This is not about making AI draw one picture — it is about making AI generate a board you can keep editing and collaborating on inside Lark.',
    },
    source: 'This article is adapted and rewritten from a Xiaohongshu (RED) note.',
  },
};

export default explore;
