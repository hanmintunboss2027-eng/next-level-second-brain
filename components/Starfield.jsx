'use client';

import { useEffect, useRef } from 'react';

/* A slow drifting starfield behind the knowledge graph. Three depth layers,
   a little parallax on pointer move, and it stops completely for anyone who
   asks for reduced motion. Canvas rather than DOM so it costs nothing. */

export default function Starfield({ height }) {
  const ref = useRef(null);
  const wrap = useRef(null);

  useEffect(function () {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0, h = 0, raf = 0, t = 0;
    let px = 0, py = 0, tx = 0, ty = 0;
    let stars = [];

    const TINTS = ['#9B8CF0', '#3C86E8', '#19C4B6', '#8FA5BF', '#C9D6E6'];

    function seed() {
      const count = Math.max(46, Math.min(150, Math.round((w * h) / 4200)));
      stars = [];
      for (let i = 0; i < count; i++) {
        const depth = i % 3;
        stars.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.5 + depth * 0.55 + Math.random() * 0.6,
          depth: depth + 1,
          tint: TINTS[Math.floor(Math.random() * TINTS.length)],
          a: 0.22 + Math.random() * 0.5,
          tw: Math.random() * Math.PI * 2,
          sp: 0.06 + Math.random() * 0.16
        });
      }
    }

    function resize() {
      const box = wrap.current;
      if (!box) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = box.clientWidth;
      h = box.clientHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      px += (tx - px) * 0.05;
      py += (ty - py) * 0.05;

      for (const s of stars) {
        const dx = px * s.depth * 5;
        const dy = py * s.depth * 5;
        const x = ((s.x * w) + dx + w) % w;
        const y = (((s.y * h) - t * s.sp * s.depth) % h + h) % h + dy * 0.2;
        const twinkle = reduce ? 1 : 0.72 + Math.sin(t * 0.03 + s.tw) * 0.28;

        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();

        if (s.depth === 3) {
          ctx.globalAlpha = s.a * twinkle * 0.16;
          ctx.beginPath();
          ctx.arc(x, y, s.r * 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce) t += 1;
      raf = requestAnimationFrame(draw);
    }

    function onMove(e) {
      const box = wrap.current;
      if (!box) return;
      const b = box.getBoundingClientRect();
      tx = ((e.clientX - b.left) / b.width - 0.5) * 2;
      ty = ((e.clientY - b.top) / b.height - 0.5) * 2;
    }
    function onLeave() { tx = 0; ty = 0; }

    resize();
    draw();
    window.addEventListener('resize', resize);
    const box = wrap.current;
    if (box && !reduce) {
      box.addEventListener('pointermove', onMove);
      box.addEventListener('pointerleave', onLeave);
    }
    return function () {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      if (box) {
        box.removeEventListener('pointermove', onMove);
        box.removeEventListener('pointerleave', onLeave);
      }
    };
  }, []);

  return (
    <div className="sky" ref={wrap} style={height ? { height: height } : undefined}>
      <canvas ref={ref} aria-hidden="true" />
    </div>
  );
}
