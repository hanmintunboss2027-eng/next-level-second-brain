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
