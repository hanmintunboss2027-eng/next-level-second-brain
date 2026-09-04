/* The shape of a finished job.

   This dashboard is not a chat window. It is a studio, and every format it
   produces is handed over differently — a text post is shown the way it will
   look in the feed, a carousel as slides you can page through, a reel as a
   script plus a shot list. So the model is asked for a structured object whose
   fields ARE the interface, not for a wall of prose we then have to guess at.

   Fields are grouped by which format uses them; a format that does not use a
   group simply leaves it out. */

export const DELIVERABLE_SCHEMA = [
  '{',
  '  "title": "5-9 words naming the deliverable",',
  '  "format": "post | image | carousel | reel | longform | newsletter",',
  '',
  '  "team": ["research","cmo","content"],',
  '  "route": "one sentence: which departments did what",',
  '  "reports": {',
  '    "cmo": "6-10 words, the report CMO hands up to CEO",',
  '    "research": "6-10 words, the report Research hands up to CEO",',
  '    "content": "6-10 words, the report Content hands up to CMO",',
  '    "leaf": "6-10 words about the format that was produced"',
  '  },',
  '  "grounded": ["Brand Kit", "the note names you actually used"],',
  '',
  '  "platform": "Facebook | Instagram | Instagram Reels | Email | Blog",',
  '  "angle": "2-3 words naming the angle taken, e.g. \\"Problem-first angle\\"",',
  '',
  '  "body": "the finished piece, ready to publish, in the brand language",',
  '  "cta": "the single call-to-action line, taken from the body",',
  '  "hooks": ["3 alternative opening lines, each a different way in"],',
  '',
  '  "caption": "carousel and image only: the caption posted with it",',
  '  "slides": [',
  '    {',
  '      "kicker": "HOOK | BUILD | PROOF | OFFER | CTA",',
  '      "headline": "at most 8 words — the big words on the slide",',
  '      "lines": ["at most 2 short supporting lines"],',
  '      "art": "one sentence of art direction: what is pictured on this slide"',
  '    }',
  '  ],',
  '',
  '  "logline": "reel only: one sentence saying what the reel is about",',
  '  "seconds": 60,',
  '  "beats": [',
  '    {',
  '      "name": "HOOK | REHOOK | BODY | PROOF | PAYOFF",',
  '      "seconds": 6,',
  '      "lines": ["the words actually spoken in this beat"],',
  '      "visual": "what the camera is on",',
  '      "text": "the words burned on screen, SHORT AND IN CAPS",',
  '      "edit": "the cut, transition or effect"',
  '    }',
  '  ]',
  '}'
].join('\n');

export const SHAPE_RULES = [
  '=== HOW TO ANSWER ===',
  'Reply with JSON only — no prose outside it, no code fence — in this shape:',
  '',
  DELIVERABLE_SCHEMA,
  '',
  'Which parts to fill in:',
  '- ALWAYS: title, format, team, route, reports, grounded, platform, angle, body, cta.',
  '- "hooks": always. 3 alternatives to the FIRST line of "body" — a different way',
  '  in each time (a question, a blunt statement, a number, a small scene). Do not',
  '  repeat the line already used in "body".',
  '- "slides" + "caption": carousel only. Exactly 7 slides. Slide 1 is the hook,',
  '  slide 7 is the call to action. "art" tells a designer what to picture — the',
  '  product, the workshop, the customer — never abstract shapes.',
  '- "caption": image posts too.',
  '- "logline" + "seconds" + "beats": reel only. 4 to 6 beats, the seconds adding up',
  '  to "seconds" (45-75). Every beat needs visual, text and edit filled in — this is',
  '  a shot list somebody has to film from.',
  '- "team" lists only departments that genuinely worked. Do not pad it.',
  '',
  'Language: write body, caption, hooks, cta, slide headlines, slide lines, beats and',
  'logline in the brand language named above. The audience reads that language even',
  'when the instruction was typed in English, so an English request is not permission',
  'to answer in English. Product and technical terms stay in English inside those',
  'sentences. Only title, route, reports, grounded, platform, angle, slide kickers and',
  'beat names stay in English — those are interface labels, not content.'
].join('\n');

const FORMATS = ['post', 'image', 'carousel', 'reel', 'longform', 'newsletter'];

const KICKERS = ['HOOK', 'BUILD', 'PROOF', 'POINT', 'OFFER', 'CTA'];
const BEATS = ['HOOK', 'REHOOK', 'BODY', 'PROOF', 'PAYOFF', 'CTA'];

function clock(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* The model is a writer, not a validator. Everything below assumes it got
   something slightly wrong and makes the result safe to render. */
export function normalise(raw, fallbackText, askedFormat) {
  const d = (raw && typeof raw === 'object') ? raw : {};
  const str = function (v, max) {
    return typeof v === 'string' ? v.trim().slice(0, max || 4000) : '';
  };
  const arr = function (v) { return Array.isArray(v) ? v : []; };
  const strs = function (v, max, cap) {
    return arr(v).map(function (x) { return str(x, max); })
      .filter(Boolean).slice(0, cap || 8);
  };

  const format = FORMATS.indexOf(str(d.format)) >= 0
    ? str(d.format)
    : (FORMATS.indexOf(askedFormat) >= 0 ? askedFormat : 'post');

  const body = str(d.body, 14000) || str(fallbackText, 14000);
  const firstLine = (body.split('\n').find(function (l) { return l.trim(); }) || '').trim();

  const slides = arr(d.slides).slice(0, 10).map(function (s, i) {
    s = s || {};
    const kick = str(s.kicker, 12).toUpperCase();
    return {
      n: i + 1,
      kicker: KICKERS.indexOf(kick) >= 0 ? kick : (i === 0 ? 'HOOK' : 'BUILD'),
      headline: str(s.headline, 90),
      lines: strs(s.lines, 140, 3),
      art: str(s.art, 320)
    };
  }).filter(function (s) { return s.headline || s.lines.length; });

  /* Beats carry their own clock so the shot list reads like a call sheet. */
  let cursor = 0;
  const beats = arr(d.beats).slice(0, 8).map(function (b, i) {
    b = b || {};
    const name = str(b.name, 12).toUpperCase();
    const secs = Math.max(2, Math.min(30, Number(b.seconds) || 8));
    const start = cursor;
    cursor += secs;
    return {
      n: i + 1,
      name: BEATS.indexOf(name) >= 0 ? name : (i === 0 ? 'HOOK' : 'BODY'),
      seconds: secs,
      start: clock(start),
      end: clock(cursor),
      lines: strs(b.lines, 300, 4),
      visual: str(b.visual, 320),
      text: str(b.text, 90),
      edit: str(b.edit, 320)
    };
  }).filter(function (b) { return b.lines.length || b.visual; });

  const dec = (d.decision && typeof d.decision === 'object') ? d.decision : {};
  const rep = (d.reports && typeof d.reports === 'object') ? d.reports : {};

  const words = body ? body.split(/\s+/).filter(Boolean).length : 0;

  return {
    title: str(d.title, 140) || 'Deliverable',
    format: format,

    team: strs(d.team, 20, 3).map(function (t) { return t.toLowerCase(); })
      .filter(function (t) { return ['cmo', 'research', 'content'].indexOf(t) >= 0; }),
    route: str(d.route, 240),
    reports: {
      cmo: str(rep.cmo, 110),
      research: str(rep.research, 110),
      content: str(rep.content, 110),
      leaf: str(rep.leaf, 110)
    },
    grounded: strs(d.grounded, 60, 6),

    platform: str(d.platform, 40) ||
      (format === 'reel' ? 'Instagram Reels'
        : format === 'newsletter' ? 'Email'
          : format === 'longform' ? 'Blog' : 'Facebook'),
    angle: str(d.angle, 40) || 'Standard angle',

    body: body,
    words: words,
    chars: body.length,
    cta: str(d.cta, 300),
    hooks: strs(d.hooks, 220, 3).filter(function (h) { return h !== firstLine; }),
    firstLine: firstLine,

    caption: str(d.caption, 2200),
    slides: format === 'carousel' ? slides : [],

    logline: str(d.logline, 300),
    seconds: format === 'reel'
      ? (cursor || Math.max(30, Math.min(90, Number(d.seconds) || 60)))
      : 0,
    beats: format === 'reel' ? beats : [],

    /* kept so older panels and the vault write-back keep working */
    decision: {
      when: str(dec.when, 300),
      then: str(dec.then, 300),
      outcome: str(dec.outcome, 300)
    },
    keyPoints: strs(d.keyPoints, 200, 5)
  };
}
