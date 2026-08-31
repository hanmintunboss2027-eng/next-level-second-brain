import { readJson, KEYS, storageMode } from '../../../lib/store';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slug(s) {
  return String(s).replace(/\.md$/i, '').split('/').pop().toLowerCase();
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
    else if (/^00-Inbox\//i.test(p)) group = 'inbox';
    else if (/^(Index|CLAUDE|Memory|Decisions)\.md$/i.test(p)) group = 'core';
    return { id: p, label: n.title || slug(p), group: group, links: 0 };
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

  const vault = await readJson(KEYS.vault, null);
  if (!vault || !vault.notes || !vault.notes.length) {
    return Response.json({
      empty: true, count: 0, storage: storageMode(),
      graph: { nodes: [], links: [] }
    });
  }

  const graph = buildGraph(vault.notes);
  const folders = {};
  vault.notes.forEach(function (n) {
    const f = n.path.indexOf('/') > 0 ? n.path.split('/')[0] : 'root';
    folders[f] = (folders[f] || 0) + 1;
  });

  return Response.json({
    empty: false,
    count: vault.count,
    updatedAt: vault.updatedAt,
    sourceName: vault.sourceName || '',
    storage: storageMode(),
    folders: folders,
    orphans: graph.nodes.filter(function (n) { return n.links === 0; }).length,
    graph: graph
  });
}
