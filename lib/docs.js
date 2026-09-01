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

export function docToNote(doc) {
  return {
    path: 'Documents/' + slugify(doc.title) + '.md',
    title: doc.title,
    body: doc.body,
    links: linksOf(doc.body),
    isDoc: true,
    id: doc.id
  };
}

/* Everything the AI can read: the uploaded vault plus the hand-added docs. */
export async function allNotes() {
  const vault = await readJson(KEYS.vault, null);
  const docs = await readJson(KEYS.docs, { items: [] });
  const base = (vault && vault.notes) || [];
  const extra = ((docs && docs.items) || []).map(docToNote);
  return { notes: base.concat(extra), vaultCount: base.length, docCount: extra.length, vault: vault };
}
