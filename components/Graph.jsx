'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* Obsidian's own convention: every note is the same violet dot and the
   folder only tints it, so the eye reads the shape of the links rather
   than a colour key it has to memorise. */
const COLORS = {
  core: '#19C4B6',
  brand: '#B7A6FF',
  raw: '#6FA8F5',
  doc: '#7DE0D6',
  wiki: '#9B8CF0',
  inbox: '#E0A458'
};

const W = 560;
const H = 440;

/* A small spring layout. No d3 — a hundred iterations of repulsion plus
   spring pull is enough for a few hundred notes and keeps the bundle tiny. */
function layout(nodes, links) {
  const n = nodes.length;
  if (!n) return [];

  const pts = nodes.map(function (node, i) {
    const ring = node.group === 'core' ? 0.12 : node.group === 'brand' || node.group === 'raw' ? 0.42 : 0.78;
    const a = (i / n) * Math.PI * 2;
    return {
      id: node.id,
      label: node.label,
      group: node.group,
      deg: node.links || 0,
      x: W / 2 + Math.cos(a) * (W * 0.38) * ring + (i % 7) * 3,
      y: H / 2 + Math.sin(a) * (H * 0.40) * ring + (i % 5) * 3,
      vx: 0,
      vy: 0
    };
  });

  const index = new Map();
  pts.forEach(function (p) { index.set(p.id, p); });

  const edges = links
    .map(function (l) { return [index.get(l.source), index.get(l.target)]; })
    .filter(function (e) { return e[0] && e[1]; });

  const repel = 6200;
  const springLen = 92;

  for (let step = 0; step < 140; step++) {
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 1) { d2 = 1; dx = (i - j) || 1; dy = 1; }
        const f = repel / d2;
        const d = Math.sqrt(d2);
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      }
    }
    for (const e of edges) {
      const a = e[0], b = e[1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (d - springLen) * 0.02;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const p of pts) {
      /* gentle pull to the middle so nothing drifts off the canvas */
      p.vx += (W / 2 - p.x) * 0.0032;
      p.vy += (H / 2 - p.y) * 0.0032;
      p.x += p.vx * 0.34;
      p.y += p.vy * 0.34;
      p.vx *= 0.72; p.vy *= 0.72;
      p.x = Math.max(46, Math.min(W - 46, p.x));
      p.y = Math.max(26, Math.min(H - 30, p.y));
    }
  }
  return pts;
}

/* The frame the map is seen through. Zooming is just a smaller window onto
   the same coordinates, which keeps every distance in the layout honest. */
function fit(pts) {
  if (!pts.length) return { x: 0, y: 0, w: W, h: H };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(function (p) {
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
  });
  const pad = 54;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = Math.max(160, x1 - x0);
  const h = Math.max(120, y1 - y0);
  /* keep the frame's shape close to the panel's so nothing is letterboxed away */
  const ratio = W / H;
  let fw = w, fh = h;
  if (w / h > ratio) fh = w / ratio; else fw = h * ratio;
  return { x: x0 - (fw - w) / 2, y: y0 - (fh - h) / 2, w: fw, h: fh };
}

export default function Graph({ graph }) {
  const nodes = (graph && graph.nodes) || [];
  const links = (graph && graph.links) || [];

  const pts = useMemo(function () {
    return layout(nodes.slice(0, 260), links);
  }, [graph]);

  const index = useMemo(function () {
    const m = new Map();
    pts.forEach(function (p) { m.set(p.id, p); });
    return m;
  }, [pts]);

  const base = useMemo(function () { return fit(pts); }, [pts]);
  const [view, setView] = useState(base);
  const svgRef = useRef(null);
  const drag = useRef(null);

  useEffect(function () { setView(base); }, [base]);

  /* Zoom towards the cursor, so the note you are pointing at stays put —
     the difference between a map you can read and one you have to chase. */
  const zoomAt = useCallback(function (factor, cx, cy) {
    setView(function (v) {
      const min = 90;                       /* how far in you can push */
      const max = Math.max(base.w * 3.2, W * 2);
      let w = Math.min(max, Math.max(min, v.w * factor));
      const k = w / v.w;
      const h = v.h * k;
      return { x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k, w: w, h: h };
    });
  }, [base.w]);

  function toUser(e) {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    /* the viewBox is fitted with "meet", so work out the real drawn box */
    const scale = Math.min(r.width / view.w, r.height / view.h);
    const dw = view.w * scale, dh = view.h * scale;
    const ox = r.left + (r.width - dw) / 2;
    const oy = r.top + (r.height - dh) / 2;
    return { x: view.x + (e.clientX - ox) / scale, y: view.y + (e.clientY - oy) / scale, scale: scale };
  }

  useEffect(function () {
    const el = svgRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const u = toUser(e);
      if (!u) return;
      zoomAt(e.deltaY > 0 ? 1.14 : 0.877, u.x, u.y);
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return function () { el.removeEventListener('wheel', onWheel); };
  });

  function down(e) {
    const u = toUser(e);
    if (!u) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, scale: u.scale };
    if (e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    setView(function (v) {
      return { x: d.vx - (e.clientX - d.x) / d.scale, y: d.vy - (e.clientY - d.y) / d.scale, w: v.w, h: v.h };
    });
  }
  function up() { drag.current = null; }

  if (!pts.length) {
    return (
      <div className="emptysky">
        Upload your vault and the map of your business appears here.
      </div>
    );
  }

  /* Far out it is a constellation; close in it is a reading map. Labels fade
     rather than pop, so the transition never feels like a redraw. */
  const zoom = base.w / view.w;
  const nameOpacity = Math.max(0, Math.min(1, (zoom - 0.62) / 0.38));
  const hairline = view.w / W;

  return (
    <>
      <div className="gzoom">
        <button type="button" title="Zoom out" aria-label="Zoom out"
          onClick={function () { zoomAt(1.3, view.x + view.w / 2, view.y + view.h / 2); }}>&minus;</button>
        <b>{Math.round(zoom * 100)}%</b>
        <button type="button" title="Zoom in" aria-label="Zoom in"
          onClick={function () { zoomAt(0.77, view.x + view.w / 2, view.y + view.h / 2); }}>+</button>
        <button type="button" title="Fit the whole map" aria-label="Fit"
          onClick={function () { setView(base); }}>&#9678;</button>
      </div>

      <svg
        ref={svgRef}
        className={drag.current ? 'grabbing' : ''}
        viewBox={view.x + ' ' + view.y + ' ' + view.w + ' ' + view.h}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={function () { setView(base); }}
        role="img" aria-label="Your knowledge graph — scroll to zoom, drag to move">
        <g stroke="#2A3A55" strokeWidth={hairline} strokeOpacity=".85">
          {links.map(function (l, i) {
            const a = index.get(l.source);
            const b = index.get(l.target);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
        <g>
          {pts.map(function (p) {
            const r = Math.min(11, 3.6 + Math.sqrt(p.deg) * 1.9) * Math.max(0.55, Math.min(1.35, hairline));
            const fill = COLORS[p.group] || COLORS.wiki;
            /* Every note is named. An unlabelled dot tells you nothing, and
               the whole point of the map is recognising your own material. */
            const label = p.label.length > 22 ? p.label.slice(0, 21) + '…' : p.label;
            return (
              <g key={p.id} className="gnode">
                <circle cx={p.x} cy={p.y} r={r + 4} fill={fill} opacity=".16" />
                <circle cx={p.x} cy={p.y} r={r} fill={fill}>
                  <title>{p.id + ' · ' + p.deg + ' links'}</title>
                </circle>
                {nameOpacity > 0.02 ? (
                  <text
                    x={p.x}
                    y={p.y + r + 11 * hairline}
                    textAnchor="middle"
                    fontFamily="'Manrope',system-ui,sans-serif"
                    fontSize={(p.deg > 1 ? 11 : 10) * hairline}
                    fill="#C4D4E6"
                    opacity={nameOpacity}
                    stroke="#0A0F1A"
                    strokeWidth={3 * hairline}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </>
  );
}
