import { readJson, writeJson, KEYS } from '../../../lib/store';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const EMPTY_BRAND = {
  name: '',
  language: 'Burmese',
  tone: '',
  useMore: '',
  neverUse: '',
  headingFont: '',
  bodyFont: '',
  feel: '',
  colors: { accent: '', support: '', dark: '', light: '', neutral: '' }
};

/* The eight things that make output stop sounding generic.
   The readiness meter counts these and nothing else. */
function readiness(b) {
  const checks = [
    Boolean(b.name),
    Boolean(b.tone),
    Boolean(b.language),
    Boolean(b.useMore),
    Boolean(b.neverUse),
    Boolean(b.headingFont || b.bodyFont),
    Boolean(b.colors && b.colors.accent),
    Boolean(b.colors && (b.colors.support || b.colors.dark || b.colors.light))
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export async function GET(request) {
  if (!checkAccess(request)) return denied();
  const brand = await readJson(KEYS.brand, EMPTY_BRAND);
  const merged = Object.assign({}, EMPTY_BRAND, brand, {
    colors: Object.assign({}, EMPTY_BRAND.colors, brand.colors || {})
  });
  return Response.json({ brand: merged, readiness: readiness(merged) });
}

export async function POST(request) {
  if (!checkAccess(request)) return denied();
  try {
    const body = await request.json();
    const incoming = body && body.brand ? body.brand : {};
    const merged = Object.assign({}, EMPTY_BRAND, incoming, {
      colors: Object.assign({}, EMPTY_BRAND.colors, incoming.colors || {})
    });
    await writeJson(KEYS.brand, merged);
    return Response.json({ ok: true, brand: merged, readiness: readiness(merged) });
  } catch (err) {
    console.error('brand save failed', err);
    return Response.json({ error: 'Could not save: ' + err.message }, { status: 500 });
  }
}
