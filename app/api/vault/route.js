import { storageMode, readJson, writeJson, KEYS } from '../../../lib/store';
import { allNotes } from '../../../lib/docs';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* "Business in a Box", "business-in-a-box.md" and "Business_in_a_Box" are
   the same note. Normalising every separator to one dash is what makes a
   [[wikilink]] typed by hand actually land on the note it names. */
function slug(s) {
  return String(s)
    .replace(/\.md$/i, '')
    .split('/').pop()
    .toLowerCase()
    .replace(/[^a-z0-9က-႟]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* Turn the notes into a node/link graph the browser can draw. */
function buildGraph(notes) {
  const bySlug = new Map();
  notes.forEach(function (n) { bySlug.set(slug(n.path), n.path); });

  const nodes = notes.map(function (n) {
    const p = n.path;
    let group = 'wiki';
    if (/^Brand\//i.test(p)) group = 'brand';
    else if (/^Raw\//i.test(p)) group = 'raw';
    else if (/^Documents\//i.test(p)) group = 'doc';
    else if (/^00-Inbox\//i.test(p)) group = 'inbox';
    else if (/^(Index|CLAUDE|Memory|Decisions)\.md$/i.test(p)) group = 'core';
    return {
      id: p, label: n.title || slug(p), group: group, links: 0,
      /* output files still get a node — the map is a record of everything the
         brain holds — but the panel needs to say which ones the AI reads. */
      kind: n.kind === 'output' ? 'output' : 'source'
    };
  });

  const index = new Map();
  nodes.forEach(function (n) { index.set(n.id, n); });

  const links = [];
  const seen = new Set();
  notes.forEach(function (n) {
    (n.links || []).forEach(function (target) {
      const t = bySlug.get(slug(target));
      if (!t || t === n.path) return;
      const key = n.path + '→' + t;
      if (seen.has(key)) return;
      seen.add(key);
      links.push({ source: n.path, target: t });
      if (index.get(n.path)) index.get(n.path).links++;
      if (index.get(t)) index.get(t).links++;
    });
  });

  return { nodes: nodes, links: links };
}

export async function GET(request) {
  if (!checkAccess(request)) return denied();

  const bundle = await allNotes();
  const notes = bundle.notes;
  const vault = bundle.vault;
  if (!notes.length) {
    return Response.json({
      empty: true, count: 0, docCount: 0, storage: storageMode(),
      graph: { nodes: [], links: [] }
    });
  }

  const graph = buildGraph(notes);
  const folders = {};
  notes.forEach(function (n) {
    const f = n.path.indexOf('/') > 0 ? n.path.split('/')[0] : 'root';
    folders[f] = (folders[f] || 0) + 1;
  });

  return Response.json({
    empty: false,
    count: notes.length,
    vaultCount: bundle.vaultCount,
    docCount: bundle.docCount,
    updatedAt: (vault && vault.updatedAt) || '',
    sourceName: (vault && vault.sourceName) || '',
    storage: storageMode(),
    folders: folders,
    orphans: graph.nodes.filter(function (n) { return n.links === 0; }).length,
    graph: graph
  });
}

/* Remove one file from the uploaded vault.

   A vault is imported wholesale, so until now the only way to get one bad file
   out of it was to re-export from Obsidian and upload everything again. That is
   too much friction for the thing people most often need: a spreadsheet from
   another business, dropped in by accident, quietly steering every answer. */
export async function DELETE(request) {
  if (!checkAccess(request)) return denied();

  const path = new URL(request.url).searchParams.get('path');
  if (!path) return Response.json({ error: 'Which file?' }, { status: 400 });

  const vault = await readJson(KEYS.vault, null);
  const notes = (vault && vault.notes) || [];
  const next = notes.filter(function (n) { return n.path !== path; });
  if (next.length === notes.length) {
    return Response.json({ error: 'No file with that path in the vault.' }, { status: 404 });
  }

  await writeJson(KEYS.vault, Object.assign({}, vault, {
    notes: next,
    updatedAt: new Date().toISOString()
  }));
  return Response.json({ ok: true, count: next.length });
}
