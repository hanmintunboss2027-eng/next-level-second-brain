/* Keyword retrieval over the uploaded vault.

   No embeddings on purpose: it costs nothing, needs no extra service,
   and for a few hundred markdown notes a well-tuned keyword score
   finds the right pages. Files that always matter (the voice print and
   the Brand/ folder) are pinned so every answer sounds like you even
   when the question does not mention them. */

const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are',
  'was', 'were', 'have', 'has', 'had', 'about', 'into', 'what', 'when',
  'which', 'who', 'how', 'why', 'can', 'will', 'would', 'should', 'a', 'an',
  'of', 'to', 'in', 'on', 'it', 'is', 'be', 'as', 'at', 'or', 'my', 'me',
  'write', 'make', 'give', 'please', 'post', 'one'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    /* keep Latin words AND Burmese runs — Burmese has no spaces between
       many words, so we treat each run of Myanmar characters as a token
       and also index 3-character slices of it. */
    .match(/[a-z0-9]{2,}|[က-႟]+/g) || [];
}

function expand(tokens) {
  const out = [];
  for (const t of tokens) {
    if (/^[က-႟]+$/.test(t)) {
      out.push(t);
      for (let i = 0; i + 3 <= t.length; i++) out.push(t.slice(i, i + 3));
    } else if (!STOP.has(t)) {
      out.push(t);
    }
  }
  return out;
}

/* Real vaults are not always tidy: the brand notes end up in "New folder",
   the voice note is called voice-emails.md. Match on what the note IS, not
   on where the workshop told someone to put it. */
const PINNED = [
  /voice[-_ ]?(print|dna|emails?|notes?)/i,
  /business[-_ ]?facts/i,
  /(^|\/)Brand\//i,
  /brand[-_ ]?(identity|messaging|positioning|voice|kit|look)/i,
  /(^|\/)(CLAUDE|Index|Memory|Decisions)\.md$/i,
  /(profile|icp|offer|business[-_ ]?profile)/i
];

function isPinned(path) {
  return PINNED.some(function (re) { return re.test(path); });
}

export function pickNotes(notes, question, budget) {
  if (!Array.isArray(notes) || !notes.length) return [];
  const limit = budget || 14;
  const q = expand(tokenize(question));
  const qSet = new Set(q);

  const scored = notes.map(function (note) {
    const hay = expand(tokenize(note.path + ' ' + note.title + ' ' + note.body));
    const counts = new Map();
    for (const t of hay) {
      if (qSet.has(t)) counts.set(t, (counts.get(t) || 0) + 1);
    }
    let score = 0;
    for (const [, n] of counts) score += 1 + Math.log(n);
    /* a hit in the title or the file name is worth more than one buried
       in the body */
    const head = expand(tokenize(note.path + ' ' + note.title));
    for (const t of head) if (qSet.has(t)) score += 2;
    if (isPinned(note.path)) score += 100;
    return { note, score };
  });

  return scored
    .filter(function (s) { return s.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, limit)
    .map(function (s) { return s.note; });
}

export function trimForContext(notes, maxChars) {
  const cap = maxChars || 42000;
  const out = [];
  let used = 0;
  for (const n of notes) {
    const body = n.body.length > 4000 ? n.body.slice(0, 4000) + '\n…(truncated)' : n.body;
    const block = '### ' + n.path + '\n' + body + '\n';
    if (used + block.length > cap) break;
    out.push(block);
    used += block.length;
  }
  return out.join('\n');
}
