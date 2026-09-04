'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { drawSlide, SIZE } from './Carousel';

/* The finished job, handed over the way a studio hands work over — and
   differently for every format, because a text post, a carousel and a reel are
   not the same kind of object.

   Text     → the post as it will look in the feed, plus alternative hooks.
   Carousel → the actual designed slides, drawn by the image model from the
              brand kit, paged through one at a time, with the caption.
   Reel     → the spoken script, and behind a tab, the shot list to film from.

   Everything shares one header and one footer so the panel still reads as a
   single piece of work. */

/* ------------------------------------------------------------------ icons */

function Check() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity=".16" />
      <path d="M7.6 12.4l2.9 2.9 5.9-6.2" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ico({ d, w }) {
  return (
    <svg viewBox="0 0 24 24" width={w || 14} height={w || 14} fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">{d}</svg>
  );
}

const I = {
  copy: <Ico d={<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>} />,
  down: <Ico d={<><path d="M12 4v11" /><path d="M7 12l5 5 5-5" /><path d="M5 20h14" /></>} />,
  text: <Ico d={<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9h10M7 13h7" /></>} />,
  deck: <Ico d={<><rect x="3" y="5" width="13" height="14" rx="2" /><path d="M19 8v9" /></>} />,
  film: <Ico d={<><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></>} />,
  mail: <Ico d={<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 8l9 6 9-6" /></>} />,
  swap: <Ico d={<><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></>} />,
  heart: <Ico d={<path d="M12 20s-7-4.5-7-9a3.6 3.6 0 0 1 7-1.5A3.6 3.6 0 0 1 19 11c0 4.5-7 9-7 9z" />} />,
  like: <Ico d={<path d="M7 20V10l4-6a2 2 0 0 1 3 2l-1 4h4a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 15.7 20z" />} />,
  chat: <Ico d={<path d="M20 12a7 7 0 0 1-9.9 6.4L4 20l1.6-5.2A7 7 0 1 1 20 12z" />} />,
  share: <Ico d={<><path d="M4 9h12l-3-3" /><path d="M20 15H8l3 3" /></>} />,
  send: <Ico d={<><path d="M21 4L3 11l7 3 3 7z" /><path d="M21 4l-11 10" /></>} />,
  grid: <Ico d={<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 10v10" /></>} />,
  expand: <Ico d={<><path d="M9 4H4v5" /><path d="M15 4h5v5" /><path d="M15 20h5v-5" /><path d="M9 20H4v-5" /></>} />,
  close: <Ico d={<><path d="M6 6l12 12M18 6L6 18" /></>} w={16} />,
  plus: <Ico d={<><path d="M12 6v12M6 12h12" /></>} w={16} />,
  minus: <Ico d={<><path d="M6 12h12" /></>} w={16} />,
  target: <Ico d={<><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>} w={16} />
};

/* ------------------------------------------------------------- the zoom */

/* Work you are about to publish has to be inspectable. This opens whatever is
   on the panel at full size and lets you push in on it — wheel or the buttons
   to zoom, drag to move around, Escape to come back. */
function Lightbox({ src, title, children, onClose }) {
  const [z, setZ] = useState(1);
  const [p, setP] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(function () {
    function key(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZ(function (v) { return Math.min(6, v * 1.25); });
      if (e.key === '-') setZ(function (v) { return Math.max(1, v / 1.25); });
      if (e.key === '0') { setZ(1); setP({ x: 0, y: 0 }); }
    }
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return function () {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function wheel(e) {
    e.preventDefault();
    setZ(function (v) { return Math.min(6, Math.max(1, v * (e.deltaY < 0 ? 1.12 : 0.89))); });
  }
  function down(e) {
    if (z <= 1) return;
    drag.current = { x: e.clientX - p.x, y: e.clientY - p.y };
  }
  function move(e) {
    if (!drag.current) return;
    setP({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  }
  function up() { drag.current = null; }

  /* Rendered into the document body, not into the panel: the deliverable card
     clips its own overflow, and a full-screen layer must not be its prisoner. */
  if (typeof document === 'undefined') return null;

  return createPortal((
    <div className="lightbox" onMouseMove={move} onMouseUp={up} onMouseLeave={up}>
      <header>
        <span className="lb-t">{title}</span>
        <div className="lb-z">
          <button type="button" title="Zoom out"
            onClick={function () { setZ(function (v) { return Math.max(1, v / 1.25); }); }}>{I.minus}</button>
          <b>{Math.round(z * 100)}%</b>
          <button type="button" title="Zoom in"
            onClick={function () { setZ(function (v) { return Math.min(6, v * 1.25); }); }}>{I.plus}</button>
          <button type="button" title="Fit"
            onClick={function () { setZ(1); setP({ x: 0, y: 0 }); }}>{I.target}</button>
        </div>
        <button type="button" className="lb-x" title="Close" onClick={onClose}>{I.close}</button>
      </header>
      <div className={'lb-stage' + (z > 1 ? ' grabbable' : '')}
        onWheel={wheel} onMouseDown={down}
        onClick={function (e) { if (e.target === e.currentTarget && z === 1) onClose(); }}>
        <div className="lb-in"
          style={{ transform: 'translate(' + p.x + 'px,' + p.y + 'px) scale(' + z + ')' }}>
          {src ? <img src={src} alt={title || ''} /> : <div className="lb-doc">{children}</div>}
        </div>
      </div>
      <footer>Scroll to zoom · drag to move · Esc to close</footer>
    </div>
  ), document.body);
}

/* ---------------------------------------------- the marketing decision */

function Briefing({ d }) {
  const dec = d.decision || {};
  const hasDec = dec.when || dec.then;
  if (!hasDec && !(d.keyPoints && d.keyPoints.length)) return null;

  return (
    <>
      {hasDec ? (
        <section className="card2 decision">
          <h4>Marketing decision</h4>
          {dec.when ? (
            <div className="dline">
              <span className="dico when">{I.swap}</span>
              <div><b>When</b><p>{dec.when}</p></div>
            </div>
          ) : null}
          {dec.when && dec.then ? <span className="dflow">&darr;</span> : null}
          {dec.then ? (
            <div className="dline">
              <span className="dico then">&rarr;</span>
              <div><b>Then</b><p className="strong">{dec.then}</p></div>
            </div>
          ) : null}
          {dec.outcome ? <p className="outcome">{dec.outcome}</p> : null}
        </section>
      ) : null}

      {d.keyPoints && d.keyPoints.length ? (
        <section className="card2 keypoints">
          <h4>Key points</h4>
          <ul>
            {d.keyPoints.map(function (k, n) {
              return <li key={n}><span className="tick"><Check /></span>{k}</li>;
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------- text post */

function Avatar({ brand }) {
  if (brand && brand.logoUrl) {
    return <span className="fbav img"><img src={brand.logoUrl} alt="" /></span>;
  }
  const n = ((brand && brand.name) || 'You').trim();
  const initials = n.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('');
  return <span className="fbav">{(initials || 'Y').toUpperCase()}</span>;
}

function TextPost({ d, brand, onCopy, copied }) {
  const [hook, setHook] = useState(-1);   /* -1 = the original */
  useEffect(function () { setHook(-1); }, [d]);

  const options = [d.firstLine].concat(d.hooks || []).filter(Boolean);
  const rest = d.body.split('\n');
  const firstIdx = rest.findIndex(function (l) { return l.trim(); });
  const shown = hook < 0 || firstIdx < 0
    ? d.body
    : rest.slice(0, firstIdx).concat([options[hook + 1] || rest[firstIdx]])
      .concat(rest.slice(firstIdx + 1)).join('\n');

  const paras = shown.split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);

  return (
    <>
      <Briefing d={d} />

      <div className="dkind"><span className="ki">{I.text}</span>Text post</div>

      <div className="chips">
        <span className="chip on">{d.platform}</span>
        <span className="chip">{d.angle}</span>
        <span className="chip">{shown.length} chars</span>
      </div>

      <section className="fbcard">
        <header>
          <Avatar brand={brand} />
          <div>
            <b>{(brand && brand.name) || 'Your brand'}</b>
            <span>{d.platform} · now</span>
          </div>
        </header>
        <div className="fbbody">
          {paras.map(function (p, i) { return <p key={i}>{p}</p>; })}
        </div>
        <footer className="fbacts">
          <span>{I.like}Like</span>
          <span>{I.chat}Comment</span>
          <span>{I.share}Repost</span>
          <span>{I.send}Send</span>
        </footer>
      </section>

      {options.length > 1 ? (
        <section className="swap">
          <h4><span className="ki">{I.swap}</span>Swap the hook</h4>
          {options.map(function (o, i) {
            const on = (i === 0 && hook < 0) || hook === i - 1;
            return (
              <button key={i} type="button" className={'hookrow' + (on ? ' on' : '')}
                onClick={function () { setHook(i === 0 ? -1 : i - 1); }}>
                <span className="hb">{on ? <Check /> : String.fromCharCode(65 + i)}</span>
                <span className="ht">{o}</span>
                {i === 0 ? <em>original</em> : null}
              </button>
            );
          })}
        </section>
      ) : null}

      {d.cta ? (
        <section className="card2 ctacard">
          <h4><span className="ki">{I.heart}</span>Call to action</h4>
          <p>{d.cta}</p>
        </section>
      ) : null}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="button" onClick={function () { onCopy(shown, 'body'); }}>
          {copied === 'body' ? 'Copied' : 'Copy post'}
        </button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- carousel */

function CarouselDeck({ d, brand, onCopy, copied, onCurrent }) {
  const [i, setI] = useState(0);
  const [imgs, setImgs] = useState([]);
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState('');
  const canvas = useRef(null);
  const run = useRef(0);

  const slides = d.slides || [];
  const total = slides.length;
  const slide = slides[i] || slides[0];
  const img = imgs[i];

  /* The brand is read while drawing, but it must never be a reason to draw
     again: any refresh elsewhere in the app hands down a new object, and
     making that restart a seven-slide render would burn the person's credit. */
  const brandRef = useRef(brand);
  brandRef.current = brand;

  useEffect(function () { if (onCurrent) onCurrent(img || ''); }, [img, onCurrent]);

  /* Draw every slide with the image model, two at a time — fast enough to
     watch, gentle enough not to trip the rate limit. A slide the model will
     not draw falls back to the canvas renderer rather than blocking the deck. */
  useEffect(function () {
    if (!total) return;
    const mine = ++run.current;
    setImgs(new Array(total).fill(null));
    setI(0);
    setNote('');

    let next = 0;
    let alive = 0;
    let giveUp = false;   /* the account cannot draw at all — stop asking */
    setBusy(total);

    function draw(n) {
      const c = document.createElement('canvas');
      drawSlide(c, { title: slides[n].headline, body: slides[n].lines || [] },
        n, total, brandRef.current || {});
      return c.toDataURL('image/png');
    }
    function put(n, src) {
      setImgs(function (prev) { const c = prev.slice(); c[n] = src; return c; });
      setBusy(function (b) { return Math.max(0, b - 1); });
    }

    function worker() {
      if (run.current !== mine) { alive -= 1; return; }
      if (giveUp || next >= total) {
        /* whatever is still blank gets the canvas renderer, so the deck is
           always complete and always downloadable */
        if (giveUp) {
          setImgs(function (prev) {
            const c = prev.slice();
            for (let k = 0; k < total; k += 1) if (!c[k]) c[k] = draw(k);
            return c;
          });
          setBusy(0);
        }
        alive -= 1;
        if (!alive) setBusy(0);
        return;
      }
      const n = next++;
      fetch('/api/slide-image', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slide: slides[n], total: total, title: d.title })
      })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, ok: r.ok, j: j }; }); })
        .then(function (out) {
          if (run.current !== mine) { alive -= 1; return; }
          if (out.ok && out.j && out.j.image) {
            put(n, out.j.image);
          } else {
            if (out.j && out.j.error) setNote(out.j.error);
            if (out.s === 403) giveUp = true;     /* not verified for images */
            put(n, draw(n));                      /* just this slide falls back */
          }
          worker();
        })
        .catch(function () {
          if (run.current !== mine) { alive -= 1; return; }
          put(n, draw(n));
          worker();
        });
    }

    /* Two at a time, the second staggered — a new OpenAI account gets a small
       images-per-minute allowance and firing them together only earns a 429. */
    alive = 2;
    worker();
    const stagger = setTimeout(worker, 7000);

    return function () { run.current += 1; clearTimeout(stagger); };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [d]);

  const save = useCallback(function (all) {
    const list = all ? slides.map(function (s, n) { return n; }) : [i];
    list.forEach(function (n) {
      const src = imgs[n];
      const name = (d.title || 'slide').replace(/[^a-z0-9]+/gi, '-').toLowerCase() +
        '-' + String(n + 1).padStart(2, '0') + '.png';
      let href = src;
      if (!href) {
        const c = document.createElement('canvas');
        drawSlide(c, { title: slides[n].headline, body: slides[n].lines || [] },
          n, total, brand || {});
        href = c.toDataURL('image/png');
      }
      const a = document.createElement('a');
      a.href = href; a.download = name; a.click();
    });
  }, [slides, imgs, i, total, brand, d.title]);

  if (!total) return null;
  const caption = d.caption || d.body || '';

  return (
    <>
      <div className="dkind"><span className="ki">{I.deck}</span>Carousel</div>

      <div className="viewer">
        <div className="stagecard">
          {img
            ? <img className="slideimg" src={img} alt={'Slide ' + (i + 1)} />
            : (
              <div className="rendering">
                <span className="ring" />
                <b>Rendering slide {i + 1} of {total}…</b>
                <em>on-brand · {(process.env.NEXT_PUBLIC_IMAGE_LABEL || 'gpt-image')}</em>
              </div>
            )}
          {total > 1 ? (
            <>
              <button className="nav prev" type="button" aria-label="Previous slide"
                onClick={function () { setI((i - 1 + total) % total); }}>‹</button>
              <button className="nav next" type="button" aria-label="Next slide"
                onClick={function () { setI((i + 1) % total); }}>›</button>
            </>
          ) : null}
        </div>

        <div className="slidebar">
          <span className="kick">{slide.kicker}</span>
          <span className="dots">
            {slides.map(function (s, n) {
              return (
                <i key={n} className={(n === i ? 'on' : '') + (imgs[n] ? ' done' : '')}
                  onClick={function () { setI(n); }} />
              );
            })}
          </span>
          <span className="count">
            {String(i + 1).padStart(2, '0')} <em>/</em> {String(total).padStart(2, '0')}
          </span>
        </div>

        {note ? <p className="imgnote">{note}</p> : null}

        <div className="row">
          <button className="btn" type="button" onClick={function () { save(false); }}>
            Download this slide
          </button>
          <button className="btn primary" type="button" disabled={busy > 0}
            onClick={function () { save(true); }}>
            {busy > 0 ? 'Rendering ' + (total - busy + 1) + '/' + total + '…' : 'Download all ' + total}
          </button>
        </div>
      </div>

      {caption ? (
        <section className="card2 caption">
          <div className="cap-h">
            <h4>Post caption</h4>
            <span className="chars">{caption.length} chars</span>
            <button className="btn" type="button" onClick={function () { onCopy(caption, 'caption'); }}>
              {copied === 'caption' ? 'Copied' : 'Copy caption'}
            </button>
          </div>
          <p className="body">{caption}</p>
        </section>
      ) : null}

      <canvas ref={canvas} width={SIZE} height={SIZE} style={{ display: 'none' }} />
    </>
  );
}

/* ------------------------------------------------------------------- reel */

function ReelScript({ d, onCopy, copied }) {
  const [tab, setTab] = useState('script');
  const beats = d.beats || [];
  useEffect(function () { setTab('script'); }, [d]);

  return (
    <>
      <div className="dkind"><span className="ki">{I.film}</span>Reel production script</div>
      {d.logline ? <p className="dlog">{d.logline}</p> : null}

      <div className="chips wide">
        <span className="chip">{d.platform}</span>
        <span className="chip">{d.seconds} sec</span>
        <span className="chip">{d.words} words</span>
      </div>

      <div className="seg">
        <button type="button" className={tab === 'script' ? 'on' : ''}
          onClick={function () { setTab('script'); }}>Script</button>
        <button type="button" className={tab === 'production' ? 'on' : ''}
          onClick={function () { setTab('production'); }}>Production</button>
      </div>

      {tab === 'script' ? (
        <div className="beats">
          {beats.map(function (b) {
            return (
              <section key={b.n} className="beat">
                <h5><i />{b.name}</h5>
                {b.lines.map(function (l, n) { return <p key={n}>{l}</p>; })}
              </section>
            );
          })}
        </div>
      ) : (
        <section className="card2 shots">
          <div className="shot-h">
            <h4><span className="ki">{I.grid}</span>Beat direction</h4>
            <span className="planned">{d.seconds}s planned</span>
          </div>
          {beats.map(function (b) {
            return (
              <div key={b.n} className="shot">
                <div className="shot-t">
                  <b>{b.name}</b>
                  <span className="tc">{b.start} to {b.end}</span>
                  <span className="dur">{b.seconds}s</span>
                </div>
                {b.visual ? <p><span className="tag vis">Visual</span>{b.visual}</p> : null}
                {b.text ? <p><span className="tag txt">Text</span>{b.text}</p> : null}
                {b.edit ? <p><span className="tag cut">Edit</span>{b.edit}</p> : null}
              </div>
            );
          })}
        </section>
      )}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="button" onClick={function () { onCopy(d.body, 'body'); }}>
          {copied === 'body' ? 'Copied' : 'Copy the spoken script'}
        </button>
      </div>
    </>
  );
}

/* -------------------------------------------------- everything else */

function LongPiece({ d, onCopy, copied }) {
  const label = d.format === 'newsletter' ? 'Newsletter'
    : d.format === 'longform' ? 'Long-form' : 'Image post';
  const icon = d.format === 'newsletter' ? I.mail : d.format === 'image' ? I.deck : I.text;
  const paras = (d.body || '').split(/\n{2,}/).map(function (p) { return p.trim(); }).filter(Boolean);

  return (
    <>
      <Briefing d={d} />

      <div className="dkind"><span className="ki">{icon}</span>{label}</div>

      <div className="chips wide">
        <span className="chip">{d.platform}</span>
        <span className="chip">{d.angle}</span>
        <span className="chip">{d.words} words</span>
      </div>

      <section className="card2 doc">
        {paras.map(function (p, i) { return <p key={i}>{p}</p>; })}
      </section>

      {d.caption ? (
        <section className="card2 caption">
          <div className="cap-h">
            <h4>Post caption</h4>
            <span className="chars">{d.caption.length} chars</span>
            <button className="btn" type="button" onClick={function () { onCopy(d.caption, 'caption'); }}>
              {copied === 'caption' ? 'Copied' : 'Copy caption'}
            </button>
          </div>
          <p className="body">{d.caption}</p>
        </section>
      ) : null}

      {d.cta ? (
        <section className="card2 ctacard">
          <h4><span className="ki">{I.heart}</span>Call to action</h4>
          <p>{d.cta}</p>
        </section>
      ) : null}

      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn" type="button" onClick={function () { onCopy(d.body, 'body'); }}>
          {copied === 'body' ? 'Copied' : 'Copy text'}
        </button>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- shell */

export default function Deliverable({ d, brand, running, step, onCopy, copied }) {
  const [slideSrc, setSlideSrc] = useState('');
  const [zoom, setZoom] = useState(false);
  const current = useCallback(function (src) { setSlideSrc(src); }, []);

  useEffect(function () { setZoom(false); }, [d]);

  if (!d) return null;

  function download() {
    const text = [d.title, '', d.body, d.caption ? '\n' + d.caption : ''].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = (d.title || 'deliverable').replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.txt';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  return (
    <div className="deliv">
      <header className="deliv-h">
        <span className="lab"><i />Deliverable</span>
        <div className="hbtns">
          <button type="button" title="Open full size" aria-label="Open full size"
            onClick={function () { setZoom(true); }}>{I.expand}</button>
          <button type="button" title="Download" aria-label="Download"
            onClick={download}>{I.down}</button>
        </div>
        <h3>{d.title}</h3>
        {d.subtitle ? <p className="deliv-sub">{d.subtitle}</p> : null}
      </header>

      <div className="deliv-b">
        {d.format === 'carousel'
          ? <CarouselDeck d={d} brand={brand} onCopy={onCopy} copied={copied} onCurrent={current} />
          : d.format === 'reel'
            ? <ReelScript d={d} onCopy={onCopy} copied={copied} />
            : d.format === 'post'
              ? <TextPost d={d} brand={brand} onCopy={onCopy} copied={copied} />
              : <LongPiece d={d} onCopy={onCopy} copied={copied} />}

        {d.grounded && d.grounded.length ? (
          <section className="grounded">
            <h4>Grounded in</h4>
            <div className="chips">
              {d.grounded.map(function (g, i) { return <span key={i} className="chip">{g}</span>; })}
            </div>
          </section>
        ) : null}
      </div>

      <footer className={'deliv-f' + (running ? ' busy' : '')}>
        <span className="tick"><Check /></span>
        {running ? (step || 'Working…') : 'Run complete · deliverable ready'}
      </footer>

      {zoom ? (
        <Lightbox
          title={d.title}
          src={d.format === 'carousel' ? slideSrc : ''}
          onClose={function () { setZoom(false); }}
        >
          <h2>{d.title}</h2>
          {d.subtitle ? <p className="lead">{d.subtitle}</p> : null}
          {(d.body || '').split(/\n{2,}/).map(function (para, n) {
            return <p key={n}>{para.trim()}</p>;
          })}
          {d.caption ? (
            <>
              <h3>Post caption</h3>
              <p>{d.caption}</p>
            </>
          ) : null}
        </Lightbox>
      ) : null}
    </div>
  );
}
