'use client';

import { useMemo } from 'react';

const COLORS = {
  core: '#19C4B6',
  brand: '#9B8CF0',
  raw: '#3C86E8',
  wiki: '#7E93A8',
  inbox: '#E0A458'
};

const W = 520;
const H = 380;

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

  const repel = 2400;
  const springLen = 62;

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
      p.vx += (W / 2 - p.x) * 0.006;
      p.vy += (H / 2 - p.y) * 0.006;
      p.x += p.vx * 0.34;
      p.y += p.vy * 0.34;
      p.vx *= 0.72; p.vy *= 0.72;
      p.x = Math.max(26, Math.min(W - 26, p.x));
      p.y = Math.max(22, Math.min(H - 22, p.y));
    }
  }
  return pts;
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

  if (!pts.length) {
    return (
      <div className="emptysky">
        Upload your vault and the map of your business appears here.
      </div>
    );
  }

  return (
    <>
      <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label="Your knowledge graph">
        <g stroke="#1B2C46" strokeWidth="1">
          {links.map(function (l, i) {
            const a = index.get(l.source);
            const b = index.get(l.target);
            if (!a || !b) return null;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
          })}
        </g>
        <g>
          {pts.map(function (p) {
            const r = Math.min(15, 4.5 + Math.sqrt(p.deg) * 2.4);
            return (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r={r} fill={COLORS[p.group] || COLORS.wiki}>
                  <title>{p.id + ' · ' + p.deg + ' links'}</title>
                </circle>
                {r >= 9 ? (
                  <text
                    x={p.x}
                    y={p.y + r + 11}
                    textAnchor="middle"
                    fontFamily="'JetBrains Mono',monospace"
                    fontSize="9.5"
                    fill="#8FA5BF"
                  >
                    {p.label.length > 18 ? p.label.slice(0, 17) + '…' : p.label}
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
