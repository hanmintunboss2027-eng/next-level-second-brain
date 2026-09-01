import { readJson, writeJson, KEYS } from '../../../lib/store';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const EMPTY_BRAND = {
  name: '',
  handle: '',
  tagline: '',
  website: '',
  language: 'Burmese',
  tone: '',
  useMore: '',
  neverUse: '',
  headingFont: '',
  bodyFont: '',
  feel: '',
  faceUrl: '',
  logoUrl: '',
  references: [],
  palette: [],
  imageQuality: 'high',
  colors: { accent: '', support: '', dark: '', light: '', neutral: '' }
};

/* The eight things that make output stop sounding generic.
   The readiness meter counts these and nothing else. */
function readiness(b) {
  const checks = [
    Boolean(b.name),
    Boolean(b.tagline),
    Boolean(b.tone),
    Boolean(b.useMore),
    Boolean(b.neverUse),
    Boolean(b.headingFont || b.bodyFont),
    Boolean(b.colors && b.colors.accent),
    Boolean(b.colors && (b.colors.support || b.colors.dark || b.colors.light)),
    Boolean(b.faceUrl),
    Boolean(b.logoUrl)
  ];
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}

export async function GET(request) {
  if (!checkAccess(request)) return denied();
  const brand = await readJson(KEYS.brand, EMPTY_BRAND);
  const merged = Object.assign({}, EMPTY_BRAND, brand, {
    colors: Object.assign({}, EMPTY_BRAND.colors, brand.colors || {}),
    references: Array.isArray(brand.references) ? brand.references : [],
    palette: Array.isArray(brand.palette) ? brand.palette : []
  });
  return Response.json({ brand: merged, readiness: readiness(merged) });
}

export async function POST(request) {
  if (!checkAccess(request)) return denied();
  try {
    const body = await request.json();
    const incoming = body && body.brand ? body.brand : {};
    const merged = Object.assign({}, EMPTY_BRAND, incoming, {
      colors: Object.assign({}, EMPTY_BRAND.colors, incoming.colors || {}),
      references: Array.isArray(incoming.references) ? incoming.references.slice(0, 4) : [],
      palette: Array.isArray(incoming.palette) ? incoming.palette.slice(0, 14) : []
    });
    await writeJson(KEYS.brand, merged);
    return Response.json({ ok: true, brand: merged, readiness: readiness(merged) });
  } catch (err) {
    console.error('brand save failed', err);
    return Response.json({ error: 'Could not save: ' + err.message }, { status: 500 });
  }
}
