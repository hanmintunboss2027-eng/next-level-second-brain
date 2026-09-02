import { put } from '@vercel/blob';
import { checkAccess, denied } from '../../../lib/auth';
import { storageModeChecked } from '../../../lib/store';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX = 4 * 1024 * 1024;
const OK = /^image\/(png|jpe?g|webp|svg\+xml)$/i;

/* Founder photo, logo mark, and the visual references the brand kit learns
   from. Images go straight to Blob and only the URL is kept in the brand. */
export async function POST(request) {
  if (!checkAccess(request)) return denied();

  if ((await storageModeChecked()) !== 'blob') {
    return Response.json({
      error:
        'No storage attached, so images cannot be saved. Open your project on ' +
        'Vercel, click Storage in the left sidebar, add a Blob store, then Redeploy.'
    }, { status: 400 });
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    const slot = String(form.get('slot') || 'asset').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || 'asset';

    if (!file || typeof file.arrayBuffer !== 'function') {
      return Response.json({ error: 'No image was attached.' }, { status: 400 });
    }
    if (file.size > MAX) {
      return Response.json({ error: 'That image is over 4 MB. Use a smaller one.' }, { status: 400 });
    }
    if (file.type && !OK.test(file.type)) {
      return Response.json({ error: 'PNG, JPG, WebP or SVG only.' }, { status: 400 });
    }

    const ext = (file.name && file.name.match(/\.[a-z0-9]+$/i)) ? file.name.match(/\.[a-z0-9]+$/i)[0] : '.png';
    const key = 'brand/' + slot + '-' + Date.now().toString(36) + ext;

    const blob = await put(key, Buffer.from(await file.arrayBuffer()), {
      access: 'public',
      contentType: file.type || 'image/png',
      addRandomSuffix: false,
      allowOverwrite: true
    });

    return Response.json({ ok: true, url: blob.url, slot: slot });
  } catch (err) {
    console.error('asset upload failed', err);
    return Response.json({ error: 'Upload failed: ' + err.message }, { status: 500 });
  }
}
