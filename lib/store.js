import { put, list, get } from '@vercel/blob';

/* A tiny JSON store.
   With a Blob store attached it writes to Blob. Without one — local dev, or a
   preview with no storage — it keeps things in memory so the app still runs
   instead of crashing.

   Two things about Vercel Blob that this file exists to absorb:

   1. Which env var says a store is attached has changed. Older projects get
      BLOB_READ_WRITE_TOKEN; newer ones get BLOB_STORE_ID and the SDK finds its
      own credentials. Checking for one name only made a working store look
      missing, so we check for any of them and then actually try.

   2. Stores created today default to PRIVATE, and a private store rejects
      `access: 'public'` outright. Rather than guess, write private first and
      fall back to public for older public stores — then remember which one
      this store accepts. */

const mem = globalThis.__nlStore || (globalThis.__nlStore = {});

let blobWorks = globalThis.__nlBlobWorks;
let accessMode = globalThis.__nlBlobAccess;   /* 'private' | 'public' */

function blobConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.BLOB_STORE_ID ||
    process.env.BLOB_WEBHOOK_PUBLIC_KEY
  );
}

function remember(ok) {
  blobWorks = ok;
  globalThis.__nlBlobWorks = ok;
  return ok;
}

async function useBlob() {
  if (typeof blobWorks === 'boolean') return blobWorks;
  if (!blobConfigured()) return remember(false);
  try {
    await list({ limit: 1 });
    return remember(true);
  } catch (err) {
    console.error('Blob is configured but unreachable, using memory:', err.message);
    return remember(false);
  }
}

async function putJson(key, body) {
  const opts = {
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    /* These blobs are always written to the same key and read back immediately.
       Blob's default is to cache an upload at the edge for a year, which for an
       overwrite means a save can appear to have done nothing: the write lands,
       the next read is served the previous copy, and the change comes back a
       minute later as if by itself. This is state, not an asset — never cache
       it. */
    cacheControlMaxAge: 0
  };
  const order = accessMode
    ? [accessMode]
    : ['private', 'public'];

  let last = null;
  for (const access of order) {
    try {
      const res = await put(key, body, Object.assign({ access: access }, opts));
      accessMode = access;
      globalThis.__nlBlobAccess = access;
      return res;
    } catch (err) {
      last = err;
      /* Only worth trying the other mode when the store rejected THIS one. */
      if (!/access|private|public/i.test(err.message || '')) throw err;
    }
  }
  throw last;
}

export async function readJson(key, fallback) {
  if (!(await useBlob())) return key in mem ? mem[key] : fallback;

  /* get() is the only way to read a blob in a PRIVATE store — its URL is not
     publicly fetchable. It requires the access mode, and the mode has to match
     how the blob was written, so try the remembered one first. */
  const modes = accessMode ? [accessMode, accessMode === 'private' ? 'public' : 'private']
    : ['private', 'public'];
  for (const access of modes) {
    try {
      const res = await get(key, { access: access });
      if (res && res.statusCode === 200 && res.stream) {
        const text = await new Response(res.stream).text();
        if (text) {
          accessMode = access;
          globalThis.__nlBlobAccess = access;
          return JSON.parse(text);
        }
      }
      if (res === null) return fallback;   /* store reachable, nothing written yet */
    } catch (err) { /* try the other mode, then the public URL below */ }
  }

  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs || !blobs.length) return fallback;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (err) {
    console.error('readJson failed for', key, err.message);
    return fallback;
  }
}

export async function writeJson(key, value) {
  if (await useBlob()) {
    try {
      await putJson(key, JSON.stringify(value));
      return { stored: 'blob' };
    } catch (err) {
      /* Never lose the person's work over a storage hiccup — keep it in
         memory for this instance and let the UI report the downgrade. */
      console.error('Blob write failed, falling back to memory:', err.message);
      remember(false);
    }
  }
  mem[key] = value;
  return { stored: 'memory' };
}

export const KEYS = {
  vault: 'vault.json',
  brand: 'brand.json',
  docs: 'docs.json'
};

export function storageMode() {
  if (typeof blobWorks === 'boolean') return blobWorks ? 'blob' : 'memory';
  return blobConfigured() ? 'blob' : 'memory';
}

/* The honest answer: it actually writes nothing, but it has really talked to
   the store. Used by /api/status, which is what the UI badge reads. */
export async function storageModeChecked() {
  return (await useBlob()) ? 'blob' : 'memory';
}
