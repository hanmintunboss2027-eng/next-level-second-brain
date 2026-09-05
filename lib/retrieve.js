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
  /business[-_ ]?profile/i,
  /(^|\/)(icp|offer|offering)s?\b/i
];

function isPinned(path) {
  /* A spreadsheet export is data, not a brief. A bare "profile" rule used to
     match a CRM's Profile.csv and hand it a pinning bonus, which meant one
     business's customer list was force-fed into every run — including the runs
     for a completely different business. Pinning is for hand-written brand
     notes; a table of rows never qualifies. */
  if (/\.(csv|tsv|xlsx?|json|ya?ml)$/i.test(path)) return false;
  return PINNED.some(function (re) { return re.test(path); });
}

export function pickNotes(notes, question, budget) {
  if (!Array.isArray(notes) || !notes.length) return [];
  const limit = budget || 14;

  /* Every finished piece is filed back into the vault so the knowledge map
     grows with the work. Those files are output, not source: reading them back
     as research is how a single stray test run keeps reappearing in every
     answer afterwards, each time reinforcing itself. They stay in the vault and
     on the graph — they just don't get to vote on what the next piece is
     about. */
  const source = notes.filter(function (n) { return n.kind !== 'output'; });
  const pool = source.length ? source : notes;

  const qSet = new Set(expand(tokenize(question)));

  const hays = pool.map(function (note) {
    return expand(tokenize(note.path + ' ' + note.title + ' ' + note.body));
  });

  /* Burmese is written without spaces, so a token here is a three-character
     slice — and a slice like "မှုများ" turns up in every note there is. Counting
     raw hits therefore ranks by length rather than by subject: the longest
     document wins whatever you asked about. Weighting each token by how rare it
     is across this vault is what makes the score mean "this note is about your
     question" instead of "this note is big". */
  const df = new Map();
  hays.forEach(function (hay) {
    const seen = new Set();
    for (const t of hay) {
      if (!qSet.has(t) || seen.has(t)) continue;
      seen.add(t);
      df.set(t, (df.get(t) || 0) + 1);
    }
  });
  const total = pool.length;
  function idf(t) {
    const d = df.get(t) || 0;
    return d ? Math.log(1 + total / d) : 0;
  }

  const scored = pool.map(function (note, i) {
    const counts = new Map();
    for (const t of hays[i]) {
      if (qSet.has(t)) counts.set(t, (counts.get(t) || 0) + 1);
    }
    let score = 0;
    for (const [t, n] of counts) score += (1 + Math.log(n)) * idf(t);
    /* a hit in the title or the file name is worth more than one buried
       in the body */
    const head = expand(tokenize(note.path + ' ' + note.title));
    for (const t of head) if (qSet.has(t)) score += 2 * idf(t);
    if (isPinned(note.path)) score += 100;
    return { note: note, score: score };
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
