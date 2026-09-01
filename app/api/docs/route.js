import { readJson, writeJson, KEYS } from '../../../lib/store';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_DOCS = 120;
const MAX_BODY = 60000;

function newId() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function GET(request) {
  if (!checkAccess(request)) return denied();
  const docs = await readJson(KEYS.docs, { items: [] });
  const items = (docs.items || []).map(function (d) {
    return { id: d.id, title: d.title, addedAt: d.addedAt, size: (d.body || '').length };
  });
  return Response.json({ items: items, count: items.length });
}

export async function POST(request) {
  if (!checkAccess(request)) return denied();
  try {
    const ctype = request.headers.get('content-type') || '';
    const docs = await readJson(KEYS.docs, { items: [] });
    const items = docs.items || [];
    const added = [];

    if (ctype.indexOf('multipart/form-data') >= 0) {
      const form = await request.formData();
      const files = form.getAll('files');
      for (const f of files) {
        if (!f || typeof f.arrayBuffer !== 'function') continue;
        const name = f.name || 'document';
        if (!/\.(md|markdown|txt|csv)$/i.test(name)) continue;
        const body = Buffer.from(await f.arrayBuffer()).toString('utf8');
        if (!body.trim()) continue;
        added.push({
          id: newId(),
          title: name.replace(/\.[a-z]+$/i, ''),
          body: body.slice(0, MAX_BODY),
          addedAt: new Date().toISOString()
        });
      }
      if (!added.length) {
        return Response.json(
          { error: 'Nothing readable in there. Use .md, .txt or .csv files.' },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json();
      const title = String((body && body.title) || '').trim();
      const text = String((body && body.body) || '').trim();
      if (!title || !text) {
        return Response.json({ error: 'Give it a title and some content.' }, { status: 400 });
      }
      added.push({
        id: newId(),
        title: title.slice(0, 120),
        body: text.slice(0, MAX_BODY),
        addedAt: new Date().toISOString()
      });
    }

    const next = items.concat(added).slice(-MAX_DOCS);
    await writeJson(KEYS.docs, { items: next });
    return Response.json({ ok: true, added: added.length, count: next.length });
  } catch (err) {
    console.error('docs save failed', err);
    return Response.json({ error: 'Could not save: ' + err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!checkAccess(request)) return denied();
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Which document?' }, { status: 400 });
  const docs = await readJson(KEYS.docs, { items: [] });
  const next = (docs.items || []).filter(function (d) { return d.id !== id; });
  await writeJson(KEYS.docs, { items: next });
  return Response.json({ ok: true, count: next.length });
}
