import { readJson, KEYS } from './store';

/* Source documents the person adds by hand — a brief, an ICP, a research
   note. They live beside the uploaded vault and behave exactly like notes:
   searchable, linkable, and visible as their own nodes on the graph. */

export function slugify(title) {
  return String(title || 'document')
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'document';
}

export function linksOf(body) {
  const out = [];
  const re = /\[\[([^\]|#]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim();
    if (t && out.indexOf(t) < 0) out.push(t);
  }
  return out;
}

/* Two kinds of document live in here. A source is something the person put in —
   a brief, an ICP, a transcript — and the AI is meant to read it. An output is
   something the AI itself made and filed back so the map grows; it belongs in
   the vault but must never be mistaken for research later. Older sessions were
   saved before the flag existed, so the title they were given identifies them
   just as reliably. */
function kindOf(doc) {
  if (doc.kind === 'output' || doc.kind === 'source') return doc.kind;
  return /^\s*Session\s*[—–-]\s/.test(String(doc.title || '')) ? 'output' : 'source';
}

export function docToNote(doc) {
  return {
    path: 'Documents/' + slugify(doc.title) + '.md',
    title: doc.title,
    body: doc.body,
    links: linksOf(doc.body),
    isDoc: true,
    kind: kindOf(doc),
    id: doc.id
  };
}

/* Everything the AI can read: the uploaded vault plus the hand-added docs. */
export async function allNotes() {
  const vault = await readJson(KEYS.vault, null);
  const docs = await readJson(KEYS.docs, { items: [] });
  const base = (vault && vault.notes) || [];
  const extra = ((docs && docs.items) || []).map(docToNote);
  const notes = base.concat(extra);
  return {
    notes: notes,
    vaultCount: base.length,
    docCount: extra.length,
    sourceCount: notes.filter(function (n) { return n.kind !== 'output'; }).length,
    vault: vault
  };
}
