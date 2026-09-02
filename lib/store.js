import { put, list } from '@vercel/blob';

/* A tiny JSON store.
   With a Blob store attached it writes to Blob. Without one — local dev, or a
   preview with no storage — it keeps things in memory so the app still runs
   instead of crashing.

   Deciding WHICH of those we are in used to be a single check for
   BLOB_READ_WRITE_TOKEN. That was wrong: Vercel now wires newer Blob stores up
   with BLOB_STORE_ID (and an OIDC credential the SDK picks up itself) and never
   sets that token, so a project with a perfectly good Blob store looked to this
   app like it had no storage at all. So: if anything says a store is attached,
   try Blob for real, and only fall back to memory if the attempt actually
   fails. The answer is cached, because it cannot change inside one instance. */

const mem = globalThis.__nlStore || (globalThis.__nlStore = {});

/* undefined = not tried yet, true/false = the settled answer */
let blobWorks = globalThis.__nlBlobWorks;

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
    console.error('Blob is configured but unreachable, using memory', err.message);
    return remember(false);
  }
}

export async function readJson(key, fallback) {
  if (!(await useBlob())) return key in mem ? mem[key] : fallback;
  try {
    const { blobs } = await list({ prefix: key, limit: 1 });
    if (!blobs || !blobs.length) return fallback;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) return fallback;
    return await res.json();
  } catch (err) {
    console.error('readJson failed for', key, err);
    return fallback;
  }
}

export async function writeJson(key, value) {
  if (await useBlob()) {
    try {
      await put(key, JSON.stringify(value), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true
      });
      return { stored: 'blob' };
    } catch (err) {
      /* Never lose the person's work over a storage hiccup — keep it in
         memory for this instance and let the UI report the downgrade. */
      console.error('Blob write failed, falling back to memory', err.message);
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

/* Synchronous callers only need the settled answer; before the first read it
   reports what the environment claims, which is right in every real case. */
export function storageMode() {
  if (typeof blobWorks === 'boolean') return blobWorks ? 'blob' : 'memory';
  return blobConfigured() ? 'blob' : 'memory';
}

export async function storageModeChecked() {
  return (await useBlob()) ? 'blob' : 'memory';
}
