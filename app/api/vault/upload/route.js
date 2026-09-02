import JSZip from 'jszip';
import { writeJson, KEYS, storageMode } from '../../../../lib/store';
import { checkAccess, denied } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SKIP = /(^|\/)(\.|__MACOSX|\.obsidian|\.git|node_modules)/;

function titleOf(path, body) {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const base = path.split('/').pop() || path;
  return base.replace(/\.(md|markdown|txt|csv)$/i, '');
}

function linksOf(body) {
  const out = [];
  const re = /\[\[([^\]|#]+)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const t = m[1].trim();
    if (t && out.indexOf(t) < 0) out.push(t);
  }
  return out;
}

export async function POST(request) {
  if (!checkAccess(request)) return denied();

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'No file was attached.' }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const name = file.name || 'upload';
    const notes = [];

    if (/\.zip$/i.test(name)) {
      let zip;
      try {
        zip = await JSZip.loadAsync(buf);
      } catch (err) {
        return Response.json(
          { error: 'That file is not a readable .zip. Try compressing the folder again.' },
          { status: 400 }
        );
      }
      const entries = [];
      zip.forEach(function (path, entry) {
        if (entry.dir) return;
        if (SKIP.test(path)) return;
        if (!/\.(md|markdown|txt|csv)$/i.test(path)) return;
        entries.push({ path: path, entry: entry });
      });

      for (const e of entries) {
        const body = await e.entry.async('string');
        if (!body.trim()) continue;
        /* drop the top-level folder name so paths read Raw/voice-print.md */
        const clean = e.path.replace(/^[^/]+\//, '');
        notes.push({
          path: clean || e.path,
          title: titleOf(clean || e.path, body),
          body: body,
          links: linksOf(body)
        });
      }
    } else if (/\.(md|markdown|txt|csv)$/i.test(name)) {
      const body = buf.toString('utf8');
      notes.push({ path: name, title: titleOf(name, body), body: body, links: linksOf(body) });
    } else {
      return Response.json(
        { error: 'Upload a vault .zip, or a single .md, .txt or .csv file.' },
        { status: 400 }
      );
    }

    if (!notes.length) {
      return Response.json(
        { error: 'Nothing readable inside. The zip needs .md, .txt or .csv files — did you zip the whole Second-Brain folder?' },
        { status: 400 }
      );
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      sourceName: name,
      count: notes.length,
      notes: notes
    };

    await writeJson(KEYS.vault, payload);

    return Response.json({
      ok: true,
      count: notes.length,
      storage: storageMode(),
      updatedAt: payload.updatedAt
    });
  } catch (err) {
    console.error('vault upload failed', err);
    return Response.json({ error: 'Upload failed: ' + err.message }, { status: 500 });
  }
}
