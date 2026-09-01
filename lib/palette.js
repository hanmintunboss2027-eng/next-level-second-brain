/* Reads the colours out of an image the person just picked, in their own
   browser, from the file itself. Doing it here rather than from the stored
   URL means it never depends on storage being attached, on CORS, or on an
   API key — it works on the very first upload. */

function hex(r, g, b) {
  return '#' + [r, g, b].map(function (v) {
    const s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
    return s.length === 1 ? '0' + s : s;
  }).join('').toUpperCase();
}

export function toRgb(h) {
  const s = String(h || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/* 0 = black, 1 = white. Used to sort the dark and light ends apart. */
export function lightness(h) {
  const c = toRgb(h);
  if (!c) return 0.5;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/* 0 = grey, 1 = fully saturated. Used to find the colour that carries the brand. */
export function saturation(h) {
  const c = toRgb(h);
  if (!c) return 0;
  const max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]);
  return max === 0 ? 0 : (max - min) / max;
}

function hue(h) {
  const c = toRgb(h);
  if (!c) return 0;
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return 0;
  let x;
  if (max === r) x = ((g - b) / d) % 6;
  else if (max === g) x = (b - r) / d + 2;
  else x = (r - g) / d + 4;
  return (x * 60 + 360) % 360;
}

/* Two colours count as the same idea if their hues are close. */
function apart(a, b, degrees) {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d) >= degrees;
}

export function swatchesFromFile(file, want) {
  return new Promise(function (resolve) {
    if (!file || /svg/i.test(file.type || '') || typeof document === 'undefined') {
      resolve([]);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const w = 96;
      const h = Math.max(1, Math.round(img.height * (w / (img.width || w)))) || 1;
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      let d;
      try { d = ctx.getImageData(0, 0, w, h).data; } catch (e) { resolve([]); return; }

      /* Coarse buckets, so near-identical pixels land together and the
         count reflects how much of the image a colour actually covers. */
      const buckets = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 140) continue;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const key = (r >> 5) + '-' + (g >> 5) + '-' + (b >> 5);
        const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += r; e.g += g; e.b += b;
        buckets.set(key, e);
      }

      const ranked = Array.from(buckets.values())
        .sort(function (a, b2) { return b2.n - a.n; })
        .map(function (e) { return hex(e.r / e.n, e.g / e.n, e.b / e.n); });

      resolve(ranked.slice(0, want || 6));
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve([]); };
    img.src = url;
  });
}

/* Merge new swatches into the running palette without letting one photo
   flood it with twelve shades of the same beige. */
export function mergePalette(existing, incoming, cap) {
  const out = (existing || []).slice();
  (incoming || []).forEach(function (h) {
    const near = out.some(function (o) {
      const a = toRgb(o), b = toRgb(h);
      if (!a || !b) return false;
      return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 40;
    });
    if (!near) out.push(h);
  });
  return out.slice(0, cap || 14);
}

/* Turn a loose pile of colours into the five named roles the brand kit uses.
   The palette arrives in coverage order, and both facts matter: the brand
   colour is the one that is both vivid AND used a lot. Picking on vividness
   alone hands "accent" to a thin decorative stripe; picking on coverage
   alone hands it to the background. */
export function assignRoles(palette) {
  const p = (palette || []).filter(function (h) { return toRgb(h); });
  if (!p.length) return {};

  function carry(h, i) {
    const L = lightness(h);
    /* Something almost white or almost black cannot be the brand colour. */
    if (L > 0.9 || L < 0.08) return 0;
    return saturation(h) / (1 + i * 0.35);
  }

  const ranked = p.map(function (h, i) { return { h: h, s: carry(h, i) }; })
    .filter(function (x) { return x.s > 0; })
    .sort(function (a, b) { return b.s - a.s; })
    .map(function (x) { return x.h; });

  const byLight = p.slice().sort(function (a, b) { return lightness(a) - lightness(b); });

  const accent = ranked[0] || p[0];
  const support = ranked.find(function (h) { return h !== accent && apart(h, accent, 40); })
    || ranked[1] || '';

  const dark = byLight.find(function (h) { return lightness(h) < 0.28; }) || byLight[0];
  const light = byLight.slice().reverse().find(function (h) { return lightness(h) > 0.82; })
    || byLight[byLight.length - 1];

  /* A neutral is a grey, not merely a mid-toned colour. If the images have
     no grey, leave it blank rather than inventing one. */
  const neutral = p.slice().sort(function (a, b) { return saturation(a) - saturation(b); })
    .find(function (h) {
      return saturation(h) < 0.22 && lightness(h) > 0.25 && lightness(h) < 0.9
        && h !== dark && h !== light;
    }) || '';

  const roles = { accent: accent, support: support, dark: dark, light: light, neutral: neutral };
  Object.keys(roles).forEach(function (k) { if (!roles[k]) delete roles[k]; });
  return roles;
}
