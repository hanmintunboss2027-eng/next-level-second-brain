import { put, list } from '@vercel/blob';

/* A tiny JSON store.
   On Vercel with a Blob Store attached it writes to Blob.
   Without a Blob token (local dev, preview without storage) it keeps
   things in memory so the app still runs instead of crashing. */

const mem = globalThis.__nlStore || (globalThis.__nlStore = {});

function hasBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readJson(key, fallback) {
  if (!hasBlob()) return key in mem ? mem[key] : fallback;
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
  if (!hasBlob()) {
    mem[key] = value;
    return { stored: 'memory' };
  }
  await put(key, JSON.stringify(value), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });
  return { stored: 'blob' };
}

export const KEYS = {
  vault: 'vault.json',
  brand: 'brand.json'
};

export function storageMode() {
  return hasBlob() ? 'blob' : 'memory';
}
