'use client';

import { useEffect, useRef, useState } from 'react';

/* Turns a carousel written by the Content agent into actual square slides,
   drawn on canvas in the brand's own colours and fonts, ready to download
   and post. Parsing is forgiving because models format lists in many ways. */

export const SIZE = 1080;

function pick(colors, key, fallback) {
  const v = colors && colors[key];
  return v && /^#?[0-9a-fA-F]{6}$/.test(v) ? (v[0] === '#' ? v : '#' + v) : fallback;
}

export function parseSlides(text) {
  if (!text) return [];
  const lines = String(text).split(/\r?\n/);
  const slides = [];
  let cur = null;

  const head = /^\s*(?:#{1,4}\s*)?(?:\*\*)?slide\s*([0-9]{1,2})\b[^\n]*?(?:\*\*)?\s*(?:[—–:\-]\s*(.*))?$/i;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(head);
    if (m) {
      if (cur) slides.push(cur);
      cur = { n: Number(m[1]), title: (m[2] || '').replace(/\*\*/g, '').trim(), body: [] };
      continue;
    }
    if (!cur) continue;
    const clean = line.replace(/^\s*[-*•]\s*/, '').replace(/\*\*/g, '').trim();
    if (!clean) continue;
    if (/^sources?\s*:/i.test(clean)) continue;
    if (!cur.title) { cur.title = clean; continue; }
    if (cur.body.length < 4) cur.body.push(clean);
  }
  if (cur) slides.push(cur);
  return slides.filter(function (s) { return s.title || s.body.length; });
}

function wrap(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);

  /* Burmese has no spaces, so a single "word" can overflow — break it by
     character when that happens instead of letting it run off the slide. */
  const out = [];
  for (const l of lines) {
    if (ctx.measureText(l).width <= maxWidth) { out.push(l); continue; }
    let buf = '';
    for (const ch of l) {
      if (ctx.measureText(buf + ch).width > maxWidth && buf) { out.push(buf); buf = ch; }
      else buf += ch;
    }
    if (buf) out.push(buf);
  }
  return out;
}

export function drawSlide(canvas, slide, i, total, brand) {
  const ctx = canvas.getContext('2d');
  const colors = brand.colors || {};
  const dark = pick(colors, 'dark', pick(colors, 'accent', '#0B2450'));
  const accent = pick(colors, 'accent', '#0B2450');
  const support = pick(colors, 'support', '#14B3AB');
  const light = pick(colors, 'light', '#F4F7FA');
  const headFont = (brand.headingFont || 'Sora').replace(/["']/g, '');
  const bodyFont = (brand.bodyFont || 'Manrope').replace(/["']/g, '');
  const cover = i === 0;

  canvas.width = SIZE;
  canvas.height = SIZE;

  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  if (cover) { g.addColorStop(0, dark); g.addColorStop(1, accent); }
  else { g.addColorStop(0, light); g.addColorStop(1, light); }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = support;
  ctx.fillRect(96, cover ? 96 : 96, 84, 6);

  const ink = cover ? '#FFFFFF' : dark;
  const sub = cover ? 'rgba(255,255,255,.78)' : 'rgba(11,22,34,.66)';

  ctx.textBaseline = 'top';
  ctx.fillStyle = support;
  ctx.font = '600 26px "' + bodyFont + '", "Noto Sans Myanmar", sans-serif';
  ctx.fillText(cover ? 'CAROUSEL' : String(i + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0'), 96, 140);

  const titleSize = cover ? 92 : 66;
  ctx.fillStyle = ink;
  ctx.font = '700 ' + titleSize + 'px "' + headFont + '", "Noto Sans Myanmar", sans-serif';
  const titleLines = wrap(ctx, slide.title || '', SIZE - 192).slice(0, cover ? 5 : 4);
  let y = cover ? 300 : 226;
  for (const l of titleLines) { ctx.fillText(l, 96, y); y += titleSize * 1.22; }

  ctx.fillStyle = sub;
  ctx.font = '400 40px "' + bodyFont + '", "Noto Sans Myanmar", sans-serif';
  y += 26;
  for (const b of slide.body.slice(0, 4)) {
    const bl = wrap(ctx, b, SIZE - 192).slice(0, 3);
    for (const l of bl) {
      if (y > SIZE - 190) break;
      ctx.fillText(l, 96, y);
      y += 56;
    }
    y += 16;
  }

  ctx.fillStyle = cover ? 'rgba(255,255,255,.62)' : 'rgba(11,22,34,.48)';
  ctx.font = '600 26px "' + bodyFont + '", "Noto Sans Myanmar", sans-serif';
  ctx.fillText(brand.name || '', 96, SIZE - 130);

  ctx.fillStyle = support;
  ctx.fillRect(0, SIZE - 14, SIZE * ((i + 1) / total), 14);
}


/* ------------------------------------------- Burmese type, drawn locally */

/* The image model typesets Latin beautifully and Myanmar script not at all —
   ask it for "ကြီးစားပါ" and it returns a confident, meaningless approximation
   of the glyph shapes. No wording of the prompt fixes that, so for Burmese we
   stop asking: the model paints the artwork with no words in it, and the type
   is set here, on canvas, in a real Myanmar font. */

const MYANMAR = /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/;

export function hasBurmese(text) {
  return MYANMAR.test(String(text || ''));
}

/* True when this piece must be composited rather than typeset by the model. */
export function needsLocalType(slide) {
  if (!slide) return false;
  if (hasBurmese(slide.headline)) return true;
  return (slide.lines || []).some(hasBurmese);
}

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = function () { resolve(im); };
    im.onerror = reject;
    im.src = src;
  });
}

/* A webfont that has not loaded yet silently falls back to a system face, and
   on canvas that means boxes instead of Burmese. Ask for the exact faces at the
   exact sizes before drawing a single glyph. */
async function readyFonts(head, body) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const want = [
    '700 92px "' + head + '"', '400 40px "' + body + '"',
    '700 92px "Padauk"', '400 40px "Padauk"',
    '700 92px "Noto Sans Myanmar"', '400 40px "Noto Sans Myanmar"'
  ];
  try {
    await Promise.all(want.map(function (f) { return document.fonts.load(f); }));
    await document.fonts.ready;
  } catch (err) { /* draw with what we have */ }
}

/* Cover-fit, the way CSS background-size: cover does it. */
function drawCover(ctx, im, size) {
  const r = Math.max(size / im.width, size / im.height);
  const w = im.width * r;
  const h = im.height * r;
  ctx.drawImage(im, (size - w) / 2, (size - h) / 2, w, h);
}

/* Is the area we are about to write on light or dark? Sampling it beats
   guessing: the model is told to leave the lower half quiet, but a photograph
   that comes back bright at the bottom would swallow white type. */
function meanLuma(ctx, x, y, w, h) {
  let data;
  try { data = ctx.getImageData(x, y, w, h).data; }
  catch (err) { return 0.3; }
  let sum = 0;
  const step = 4 * 41;          /* every 41st pixel — plenty, and fast */
  let n = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    n += 1;
  }
  return n ? sum / n : 0.3;
}

/* Fit the headline by stepping the size down until it fits BOTH ways: few
   enough lines, and no line wider than the column. Myanmar text measures
   awkwardly through a font-fallback chain, so trusting the line count alone is
   how a headline ends up running off the right edge. */
function fitHeadline(ctx, text, font, maxWidth, start, min, maxLines) {
  let size = start;
  for (;;) {
    ctx.font = '700 ' + size + 'px ' + font;
    const lines = wrap(ctx, text, maxWidth);
    const widest = lines.reduce(function (m, l) {
      return Math.max(m, ctx.measureText(l).width);
    }, 0);
    if ((lines.length <= maxLines && widest <= maxWidth) || size <= min) {
      return { size: size, lines: lines.slice(0, maxLines) };
    }
    size -= 4;
  }
}

/* Paint the model's artwork, then set the words over it ourselves. */
export async function composeSlide(canvas, bgSrc, slide, brand, opts) {
  const o = opts || {};
  const colors = (brand && brand.colors) || {};
  const support = pick(colors, 'support', '#14B3AB');
  const headName = ((brand && brand.headingFont) || 'Noto Sans Myanmar').replace(/["']/g, '');
  const bodyName = ((brand && brand.bodyFont) || 'Noto Sans Myanmar').replace(/["']/g, '');
  const headFont = '"' + headName + '", "Noto Sans Myanmar", "Padauk", sans-serif';
  const bodyFont = '"' + bodyName + '", "Noto Sans Myanmar", "Padauk", sans-serif';

  await readyFonts(headName, bodyName);

  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = pick(colors, 'dark', '#0B2450');
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (bgSrc) {
    try { drawCover(ctx, await loadImage(bgSrc), SIZE); }
    catch (err) { /* keep the flat brand field */ }
  }

  const M = Math.round(SIZE * 0.085);       /* the 8% margin the brief asks for */

  /* The mark is measured before anything is placed. Reserving a guessed height
     for it is how supporting lines end up printed across the logo. */
  let mark = null;
  const logoSrc = brand && brand.logoUrl;
  if (logoSrc && o.mark !== false) {
    try {
      const im = await loadImage(logoSrc);
      const w = Math.round(SIZE * 0.13);
      mark = { im: im, w: w, h: Math.round(w * (im.height / im.width)) };
    } catch (err) { mark = null; }
  }
  const footerH = mark ? mark.h : ((brand && brand.name) ? 26 : 0);
  const footerGap = footerH ? 40 : 0;

  const maxW = SIZE - M * 2;
  const head = fitHeadline(ctx, slide.headline || '', headFont, maxW, 104, 46, 4);

  ctx.font = '400 38px ' + bodyFont;
  const wrapped = [];
  (slide.lines || []).slice(0, 2).forEach(function (l) {
    wrap(ctx, l, maxW).slice(0, 2).forEach(function (x) { wrapped.push(x); });
  });

  const headLead = head.size * 1.16;
  const bodyLead = 54;
  const blockH = head.lines.length * headLead + (wrapped.length ? 26 + wrapped.length * bodyLead : 0);

  let y = SIZE - M - footerH - footerGap - blockH;
  const top = Math.max(Math.round(SIZE * 0.34), Math.min(y - 46, SIZE - 200));
  if (y < top) y = top;

  /* Sample the ground the words will actually sit on, then scrim it — a scrim
     rather than a box, so the artwork stays visible underneath. */
  const zoneTop = Math.max(0, y - 60);
  const light = meanLuma(ctx, 0, zoneTop, SIZE, SIZE - zoneTop) > 0.55;
  const base = light ? '255,255,255' : '8,14,26';
  const scrim = ctx.createLinearGradient(0, zoneTop - 140, 0, SIZE);
  scrim.addColorStop(0, 'rgba(' + base + ',0)');
  scrim.addColorStop(0.4, 'rgba(' + base + ',0.66)');
  scrim.addColorStop(1, 'rgba(' + base + ',0.93)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, Math.max(0, zoneTop - 140), SIZE, SIZE);

  const ink = light ? '#0B1622' : '#FFFFFF';
  const dim = light ? 'rgba(11,22,34,.72)' : 'rgba(255,255,255,.82)';

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  ctx.fillStyle = support;
  ctx.fillRect(M, y - 34, 88, 6);

  ctx.fillStyle = ink;
  ctx.font = '700 ' + head.size + 'px ' + headFont;
  head.lines.forEach(function (l) { ctx.fillText(l, M, y); y += headLead; });

  if (wrapped.length) {
    y += 26;
    ctx.fillStyle = dim;
    ctx.font = '400 38px ' + bodyFont;
    wrapped.forEach(function (l) { ctx.fillText(l, M, y); y += bodyLead; });
  }

  /* The mark goes on last, from the real file — the model mangles a wordmark
     as readily as it mangles Burmese. */
  if (mark) {
    ctx.globalAlpha = 0.95;
    ctx.drawImage(mark.im, M, SIZE - M - mark.h, mark.w, mark.h);
    ctx.globalAlpha = 1;
  } else if (brand && brand.name) {
    ctx.fillStyle = dim;
    ctx.font = '600 26px ' + bodyFont;
    ctx.fillText(brand.name, M, SIZE - M - 26);
  }

  if (o.total > 1) {
    ctx.fillStyle = dim;
    ctx.font = '600 24px ' + bodyFont;
    ctx.textAlign = 'right';
    ctx.fillText(String(o.n).padStart(2, '0') + ' / ' + String(o.total).padStart(2, '0'),
      SIZE - M, SIZE - M - 24);
    ctx.textAlign = 'left';
  }

  return canvas.toDataURL('image/png');
}

export default function Carousel({ text, brand }) {
  const [slides, setSlides] = useState([]);
  const refs = useRef([]);

  useEffect(function () { setSlides(parseSlides(text)); }, [text]);

  useEffect(function () {
    if (!slides.length) return;
    let cancelled = false;
    const paint = function () {
      if (cancelled) return;
      slides.forEach(function (s, i) {
        const c = refs.current[i];
        if (c) drawSlide(c, s, i, slides.length, brand || {});
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    else paint();
    return function () { cancelled = true; };
  }, [slides, brand]);

  function save(i) {
    const c = refs.current[i];
    if (!c) return;
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'slide-' + String(i + 1).padStart(2, '0') + '.png';
    a.click();
  }

  function saveAll() {
    slides.forEach(function (_, i) { setTimeout(function () { save(i); }, i * 320); });
  }

  if (!slides.length) return null;

  return (
    <div className="carousel">
      <div className="carhead">
        <span>{slides.length} slides · {brand && brand.name ? brand.name : 'your brand'} colours</span>
        <button className="btn" onClick={saveAll}>Download all PNG</button>
      </div>
      <div className="carstrip">
        {slides.map(function (s, i) {
          return (
            <figure className="carslide" key={i}>
              <canvas ref={function (el) { refs.current[i] = el; }} />
              <button className="carsave" onClick={function () { save(i); }}>Save {i + 1}</button>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
