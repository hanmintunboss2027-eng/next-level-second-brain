'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { swatchesFromFile, mergePalette, assignRoles } from '../lib/palette';

/* One drawer for everything the brain runs on: the vault, the brand system,
   how carousels get produced, and any documents added by hand. */

const SWATCHES = [
  ['accent', 'Accent', 'The main colour. Entered first, used everywhere.'],
  ['support', 'Support', ''],
  ['dark', 'Dark background', ''],
  ['light', 'Light background', ''],
  ['neutral', 'Neutral', '']
];

const QUALITY = [
  ['low', 'Low', 'Fastest and cheapest, good for drafts.'],
  ['medium', 'Medium', 'Balanced quality and speed.'],
  ['high', 'High', 'Maximum detail and typography quality.']
];

const TABS = [
  ['vault', 'Second brain'],
  ['brand', 'Brand kit'],
  ['carousel', 'Carousel'],
  ['docs', 'Documents']
];

/* A photo off a phone is 4–12 MB, which is more than any upload endpoint
   should have to carry and more than the brand kit will ever display.
   Shrink it in the browser first, and hand back both a small file to upload
   and a data URL to fall back on when there is no storage attached. */
function shrinkImage(file, max) {
  return new Promise(function (resolve) {
    if (/svg/i.test(file.type || '') || /\.svg$/i.test(file.name || '')) {
      const r = new FileReader();
      r.onload = function () { resolve({ blob: file, dataUrl: String(r.result), name: file.name || 'logo.svg' }); };
      r.onerror = function () { resolve(null); };
      r.readAsDataURL(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = function () {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      /* PNG so a logo keeps its transparency, JPEG so a face stays small. */
      const keepAlpha = /png|webp/i.test(file.type || '');
      const type = keepAlpha ? 'image/png' : 'image/jpeg';
      const base = String(file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
      let dataUrl = '';
      try { dataUrl = c.toDataURL(type, 0.85); } catch (e) { resolve(null); return; }
      c.toBlob(function (blob) {
        resolve({ blob: blob || file, dataUrl: dataUrl, name: base + (keepAlpha ? '.png' : '.jpg') });
      }, type, 0.85);
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function isHex(v) { return /^#?[0-9a-fA-F]{6}$/.test(String(v || '').trim()); }
function norm(v) {
  const s = String(v || '').trim();
  return s ? (s[0] === '#' ? s : '#' + s) : '';
}

export default function Settings({ open, onClose, brand, onBrandChange, onSaveBrand,
  vault, onUploaded, headers, readiness, saving, storage }) {
  const [tab, setTab] = useState('vault');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);
  const [docs, setDocs] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [docBody, setDocBody] = useState('');
  const vaultRef = useRef(null);
  const docRef = useRef(null);
  const faceRef = useRef(null);
  const logoRef = useRef(null);
  const refRef = useRef(null);

  const loadDocs = useCallback(async function () {
    try {
      const res = await fetch('/api/docs', { headers: headers, cache: 'no-store' });
      const data = await res.json();
      if (data && data.items) setDocs(data.items);
    } catch (e) { /* the list just stays empty */ }
  }, [headers]);

  useEffect(function () { if (open) loadDocs(); }, [open, loadDocs]);

  useEffect(function () {
    function esc(e) { if (e.key === 'Escape') onClose(); }
    if (open) window.addEventListener('keydown', esc);
    return function () { window.removeEventListener('keydown', esc); };
  }, [open, onClose]);

  if (!open) return null;

  function set(key, value) { onBrandChange(Object.assign({}, brand, { [key]: value })); }
  function setColor(key, value) {
    onBrandChange(Object.assign({}, brand, {
      colors: Object.assign({}, brand.colors, { [key]: value })
    }));
  }

  async function uploadVault(file) {
    if (!file) return;
    setBusy('vault'); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: fd, headers: headers });
      const data = await res.json();
      if (!res.ok) setMsg({ kind: 'bad', text: data.error || 'Upload failed.' });
      else { setMsg({ kind: 'ok', text: data.count + ' notes imported.' }); onUploaded(); }
    } catch (err) { setMsg({ kind: 'bad', text: 'Upload failed: ' + err.message }); }
    setBusy('');
  }

  function applyAsset(slot, url, swatches) {
    /* Every image the person adds contributes to the palette, so the colour
       system is already half-built by the time they scroll down to it. */
    const palette = mergePalette(brand.palette, swatches, 14);
    if (slot === 'reference') {
      return Object.assign({}, brand, {
        references: (brand.references || []).concat([url]).filter(Boolean).slice(0, 4),
        palette: palette
      });
    }
    return Object.assign({}, brand,
      slot === 'face' ? { faceUrl: url } : { logoUrl: url },
      { palette: palette });
  }

  async function uploadAsset(file, slot) {
    if (!file) return;
    if (!/^image\//i.test(file.type || '') && !/\.(png|jpe?g|webp|svg)$/i.test(file.name || '')) {
      setMsg({ kind: 'bad', text: 'That file is not an image. Use a PNG, JPG, WebP or SVG.' });
      return;
    }
    setBusy(slot); setMsg(null);

    const small = await shrinkImage(file, slot === 'reference' ? 1200 : 640);
    if (!small) {
      setMsg({ kind: 'bad', text: 'That image could not be opened. Export it again as PNG or JPG and try once more.' });
      setBusy('');
      return;
    }

    /* The image travels inside the brand itself as a small data URL.
       That is deliberate: a Blob store created today is PRIVATE, so a blob URL
       will not render in an <img> tag at all, and a 640px shrink is only tens
       of kilobytes — small enough to live in brand.json, which IS stored
       durably. One less thing that can half-work. */
    const url = small.dataUrl;

    /* Read the colours off the original file, not the stored URL — no CORS,
       no storage, no key, and it works on the very first upload. */
    let swatches = [];
    try { swatches = await swatchesFromFile(file, slot === 'reference' ? 6 : 4); } catch (e) { }

    const next = applyAsset(slot, url, swatches);
    onBrandChange(next);
    try { await onSaveBrand(next); } catch (e) { /* the note still shows */ }

    setMsg({
      kind: 'ok',
      text: swatches.length
        ? 'Image saved, and ' + swatches.length + ' colours read from it. Scroll down to the colour system to use them.'
        : 'Image saved to your brand kit.'
    });
    setBusy('');
  }

  /* The colour half of "read my references": pure arithmetic on the palette
     already collected, so it is instant and never fails. Fields the person
     typed themselves are left alone unless they ask to overwrite. */
  function fillColours(overwrite) {
    const roles = assignRoles(brand.palette);
    const keys = Object.keys(roles);
    if (!keys.length) {
      setMsg({ kind: 'bad', text: 'Add a logo or a reference image first — the colours come from those.' });
      return;
    }
    const colors = Object.assign({}, brand.colors);
    const filled = [];
    keys.forEach(function (k) {
      if (overwrite || !colors[k]) { colors[k] = roles[k]; filled.push(k); }
    });
    if (!filled.length) {
      setMsg({ kind: 'warn', text: 'Your colour system is already filled in. Use "Replace" to overwrite it with the palette.' });
      return;
    }
    const next = Object.assign({}, brand, { colors: colors });
    onBrandChange(next);
    Promise.resolve(onSaveBrand(next)).catch(function () { });
    setMsg({ kind: 'ok', text: 'Filled ' + filled.join(', ') + ' from your images.' });
  }

  /* The wordy half. Only this part needs the API key, and it says so plainly
     when there isn't one, rather than failing silently. */
  async function readReferences() {
    const images = (brand.references || []).concat(brand.logoUrl ? [brand.logoUrl] : []).slice(0, 4);
    if (!images.length) {
      setMsg({ kind: 'bad', text: 'Add a reference image first.' });
      return;
    }
    setBusy('read'); setMsg(null);
    try {
      const res = await fetch('/api/brand/extract', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ images: images })
      });
      const data = await res.json();
      if (!res.ok) { setMsg({ kind: 'bad', text: data.error || 'Could not read the references.' }); }
      else {
        const f = data.fields || {};
        const next = Object.assign({}, brand);
        const filled = [];
        Object.keys(f).forEach(function (k) {
          if (!next[k]) { next[k] = f[k]; filled.push(k); }
        });
        if (!filled.length) {
          setMsg({ kind: 'warn', text: 'Nothing new to add — those fields are already written.' });
        } else {
          onBrandChange(next);
          await onSaveBrand(next);
          setMsg({ kind: 'ok', text: 'Wrote ' + filled.length + ' fields from your references: ' + filled.join(', ') + '. Read them and edit anything that is not you.' });
        }
      }
    } catch (err) { setMsg({ kind: 'bad', text: 'Could not read the references: ' + err.message }); }
    setBusy('');
  }

  async function clearAsset(slot) {
    const next = slot === 'face'
      ? Object.assign({}, brand, { faceUrl: '' })
      : Object.assign({}, brand, { logoUrl: '' });
    onBrandChange(next);
    try { await onSaveBrand(next); } catch (e) { /* nothing to report */ }
  }

  async function addDocFiles(files) {
    if (!files || !files.length) return;
    setBusy('docs'); setMsg(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/docs', { method: 'POST', body: fd, headers: headers });
      const data = await res.json();
      if (!res.ok) setMsg({ kind: 'bad', text: data.error || 'Could not add.' });
      else { setMsg({ kind: 'ok', text: data.added + ' document(s) added.' }); loadDocs(); onUploaded(); }
    } catch (err) { setMsg({ kind: 'bad', text: 'Failed: ' + err.message }); }
    setBusy('');
  }

  async function writeDoc() {
    if (!docTitle.trim() || !docBody.trim()) return;
    setBusy('docs'); setMsg(null);
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ title: docTitle, body: docBody })
      });
      const data = await res.json();
      if (!res.ok) setMsg({ kind: 'bad', text: data.error || 'Could not save.' });
      else { setDocTitle(''); setDocBody(''); setMsg({ kind: 'ok', text: 'Document saved.' }); loadDocs(); onUploaded(); }
    } catch (err) { setMsg({ kind: 'bad', text: 'Failed: ' + err.message }); }
    setBusy('');
  }

  async function removeDoc(id) {
    setBusy('docs');
    try {
      await fetch('/api/docs?id=' + encodeURIComponent(id), { method: 'DELETE', headers: headers });
      loadDocs(); onUploaded();
    } catch (e) { /* list refresh will show the truth */ }
    setBusy('');
  }

  const notes = vault && !vault.empty ? vault.count : 0;
  const links = vault && vault.graph ? vault.graph.links.length : 0;
  const blobOn = storage === 'blob';

  return (
    <div className="drawer-back" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="drawer" role="dialog" aria-label="Knowledge and settings">

        <header className="drawer-h">
          <div>
            <h3>Knowledge &amp; settings</h3>
            <p className="sub">One place for your brain, your brand voice, and your source documents.</p>
          </div>
          <button className="xbtn" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <nav className="drawer-tabs">
          {TABS.map(function (t) {
            return (
              <button key={t[0]} className={tab === t[0] ? 'on' : ''} onClick={function () { setTab(t[0]); }}>
                {t[1]}
              </button>
            );
          })}
        </nav>

        <div className="drawer-b">
          {msg ? (
            <div className={'note ' + msg.kind}>
              <b>{msg.kind === 'ok' ? 'Done' : msg.kind === 'warn' ? 'Saved, with a catch' : 'Did not work'}</b>
              <p>{msg.text}</p>
            </div>
          ) : null}

          {/* ---------------- SECOND BRAIN ---------------- */}
          {tab === 'vault' ? (
            <>
              <section className="card2">
                <div className="card2-h">
                  <h4>Obsidian vault</h4>
                  <span className={'dot ' + (blobOn ? 'good' : 'warn')}>
                    <i />{blobOn ? 'Blob connected' : 'No storage'}
                  </span>
                </div>
                <p className="sub">
                  Upload a vault zip. Folder paths and <span className="mono">[[wiki links]]</span> are
                  retained, so the live graph recreates your knowledge connections.
                </p>
                <div
                  className="drop"
                  onClick={function () { vaultRef.current && vaultRef.current.click(); }}
                  onDragOver={function (e) { e.preventDefault(); }}
                  onDrop={function (e) { e.preventDefault(); uploadVault(e.dataTransfer.files && e.dataTransfer.files[0]); }}
                >
                  <span className="dropico">⬆</span>
                  <b>{busy === 'vault' ? 'Importing…' : 'Drop your vault here, or browse'}</b>
                  <span>.zip, .md, .markdown or .txt — Obsidian exports work great</span>
                </div>
                <input ref={vaultRef} type="file" accept=".zip,.md,.markdown,.txt" style={{ display: 'none' }}
                  onChange={function (e) { uploadVault(e.target.files && e.target.files[0]); }} />

                <div className="stats">
                  <div className="stat"><b>{notes}</b><span>notes</span></div>
                  <div className="stat"><b>{links}</b><span>wiki links</span></div>
                  <div className="stat"><b>{(vault && vault.docCount) || 0}</b><span>documents</span></div>
                </div>

                {!blobOn ? (
                  <div className="note warn">
                    <b>No storage attached</b>
                    <p>Anything you upload is lost on the next restart. On Vercel, click
                    <b> Storage</b> in the left sidebar, add a Blob store, then Redeploy.</p>
                  </div>
                ) : null}
                {vault && vault.updatedAt ? (
                  <p className="sources">Last vault upload {new Date(vault.updatedAt).toLocaleString()}</p>
                ) : null}
              </section>
            </>
          ) : null}

          {/* ---------------- BRAND KIT ---------------- */}
          {tab === 'brand' ? (
            <>
              <section className="card2 ready">
                <span className="lbl">Brand readiness</span>
                <div className="bignum">{readiness}%</div>
                <div className="meter"><span style={{ width: readiness + '%' }} /></div>
                <p className="sub">Everything below feeds the AI before it writes or designs anything.</p>
              </section>

              <section className="card2">
                <h4>Identity assets</h4>
                <p className="sub">
                  PNG, JPG, WebP or SVG. Big photos are fine — they are shrunk here in your
                  browser before anything is sent.
                </p>
                <div className="assets">
                  {[['face', 'Founder face', faceRef, brand.faceUrl],
                    ['logo', 'Logo mark', logoRef, brand.logoUrl]].map(function (a) {
                    const slot = a[0], label = a[1], ref = a[2], url = a[3];
                    return (
                      <div className={'asset-wrap' + (busy === slot ? ' is-busy' : '')} key={slot}>
                        <button className="asset" type="button" disabled={Boolean(busy)}
                          onClick={function () { ref.current && ref.current.click(); }}>
                          {url ? <img src={url} alt="" /> : <span className="ph">＋</span>}
                          <b>{label}</b>
                          <span>{busy === slot ? 'Saving…' : url ? 'Replace' : 'Upload'}</span>
                        </button>
                        {url && busy !== slot ? (
                          <button className="asset-x" type="button" aria-label={'Remove ' + label}
                            onClick={function () { clearAsset(slot); }}>✕</button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <input ref={faceRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                  style={{ display: 'none' }}
                  onChange={function (e) {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = '';            /* so the same file can be picked again */
                    uploadAsset(f, 'face');
                  }} />
                <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                  style={{ display: 'none' }}
                  onChange={function (e) {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = '';
                    uploadAsset(f, 'logo');
                  }} />
              </section>

              <section className="card2">
                <h4>Visual reference lab</h4>
                <p className="sub">Up to four great examples. The AI reads the recurring system, not just the mood.</p>
                <div className="refs">
                  {(brand.references || []).map(function (u, i) {
                    return (
                      <span className="ref" key={i}>
                        <img src={u} alt="" />
                        <button type="button" onClick={function () {
                          const next = Object.assign({}, brand, {
                            references: (brand.references || []).filter(function (_, j) { return j !== i; })
                          });
                          onBrandChange(next);
                          Promise.resolve(onSaveBrand(next)).catch(function () { });
                        }} aria-label="Remove">✕</button>
                      </span>
                    );
                  })}
                  {(brand.references || []).length < 4 ? (
                    <button className="ref add" type="button" disabled={Boolean(busy)}
                      onClick={function () { refRef.current && refRef.current.click(); }}>
                      {busy === 'reference' ? '…' : '＋'}
                      <span>{busy === 'reference' ? 'Saving' : 'Add reference'}</span>
                    </button>
                  ) : null}
                </div>
                <input ref={refRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/*"
                  style={{ display: 'none' }}
                  onChange={function (e) {
                    const f = e.target.files && e.target.files[0];
                    e.target.value = '';
                    uploadAsset(f, 'reference');
                  }} />

                {(brand.palette || []).length ? (
                  <div className="palette">
                    <span className="lbl">Read from your images</span>
                    <div className="chips">
                      {(brand.palette || []).map(function (h, i) {
                        return <i key={i} style={{ background: h }} title={h} />;
                      })}
                    </div>
                  </div>
                ) : null}

                <div className="reflab">
                  <button className="btn" type="button" disabled={Boolean(busy)}
                    onClick={function () { fillColours(false); }}>
                    Fill my colour system
                  </button>
                  <button className="btn ghost" type="button" disabled={Boolean(busy)}
                    onClick={function () { fillColours(true); }}>
                    Replace
                  </button>
                  <button className="btn go" type="button" disabled={Boolean(busy)}
                    onClick={readReferences}>
                    {busy === 'read' ? 'Reading…' : 'Read the rest with AI →'}
                  </button>
                </div>
                <p className="sub tiny">
                  Colours are read here in your browser and cost nothing. The AI button writes
                  the tone, feel, fonts and guardrails, and needs your OpenAI key. Neither one
                  overwrites anything you typed yourself.
                </p>
              </section>

              <section className="card2">
                <h4>Brand identity</h4>
                <p className="sub">The recurring signature shown across every deliverable.</p>
                <div className="grid2">
                  <label className="fld"><span className="lbl">Founder / brand name</span>
                    <input type="text" value={brand.name || ''} placeholder="Next Level by HMT"
                      onChange={function (e) { set('name', e.target.value); }} /></label>
                  <label className="fld"><span className="lbl">Handle</span>
                    <input type="text" value={brand.handle || ''} placeholder="@nextlevel"
                      onChange={function (e) { set('handle', e.target.value); }} /></label>
                </div>
                <label className="fld"><span className="lbl">Tagline</span>
                  <input type="text" value={brand.tagline || ''} placeholder="AI Education · Life Skills · Business Growth"
                    onChange={function (e) { set('tagline', e.target.value); }} /></label>
                <label className="fld"><span className="lbl">Website</span>
                  <input type="text" value={brand.website || ''} placeholder="https://example.com"
                    onChange={function (e) { set('website', e.target.value); }} /></label>
              </section>

              <section className="card2">
                <h4>Colour system</h4>
                <p className="sub">Exact values are injected into every visual. The first colour is the main accent.</p>
                <div className="swatches">
                  {SWATCHES.map(function (s) {
                    const key = s[0];
                    const val = (brand.colors && brand.colors[key]) || '';
                    return (
                      <label className="sw" key={key}>
                        <i style={{ background: isHex(val) ? norm(val) : 'transparent' }} />
                        <span style={{ minWidth: 0 }}>
                          <span className="n">{s[1]}</span>
                          <input type="text" value={val} placeholder="#0B2450"
                            onChange={function (e) { setColor(key, e.target.value); }}
                            onBlur={function (e) { setColor(key, e.target.value ? norm(e.target.value) : ''); }} />
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <div className="grid2">
                <section className="card2">
                  <h4>Typography</h4>
                  <p className="sub">Name a font, or describe the character you want.</p>
                  <label className="fld"><span className="lbl">Headline system</span>
                    <input type="text" value={brand.headingFont || ''} placeholder="Sora — geometric, confident"
                      onChange={function (e) { set('headingFont', e.target.value); }} /></label>
                  <label className="fld"><span className="lbl">Body system</span>
                    <input type="text" value={brand.bodyFont || ''} placeholder="Manrope — clean, high legibility"
                      onChange={function (e) { set('bodyFont', e.target.value); }} /></label>
                </section>

                <section className="card2">
                  <h4>Voice DNA</h4>
                  <p className="sub">How the brand should sound when the AI writes.</p>
                  <label className="fld"><span className="lbl">Language</span>
                    <input type="text" value={brand.language || ''} placeholder="Burmese"
                      onChange={function (e) { set('language', e.target.value); }} /></label>
                  <label className="fld"><span className="lbl">Tone and rhythm</span>
                    <textarea rows={4} value={brand.tone || ''}
                      placeholder="Plain everyday Burmese. Short declarative sentences. Direct, practical, teacher-first. Technical terms stay in English."
                      onChange={function (e) { set('tone', e.target.value); }} /></label>
                </section>
              </div>

              <section className="card2">
                <h4>Language guardrails</h4>
                <p className="sub">Give every agent the same verbal instincts.</p>
                <div className="grid2">
                  <label className="fld"><span className="lbl">Use more of</span>
                    <textarea rows={4} value={brand.useMore || ''}
                      placeholder="Client numbers, real examples, questions that earn a reply"
                      onChange={function (e) { set('useMore', e.target.value); }} /></label>
                  <label className="fld"><span className="lbl">Never use</span>
                    <textarea rows={4} value={brand.neverUse || ''}
                      placeholder="Paste section 7 of Raw/voice-print.md — the things you would never say"
                      onChange={function (e) { set('neverUse', e.target.value); }} /></label>
                </div>
                <label className="fld"><span className="lbl">Brand feel — 3 to 5 words</span>
                  <input type="text" value={brand.feel || ''} placeholder="direct · practical · teacher-first · no hype"
                    onChange={function (e) { set('feel', e.target.value); }} /></label>
              </section>

              <div className="drawer-foot">
                <button className="btn primary" onClick={onSaveBrand} disabled={saving}>
                  {saving ? 'Saving…' : 'Save brand system'}
                </button>
              </div>
            </>
          ) : null}

          {/* ---------------- CAROUSEL ---------------- */}
          {tab === 'carousel' ? (
            <>
              <section className="card2">
                <h4>Carousel production</h4>
                <p className="sub">
                  The Content agent writes the slides, then the image model designs each one from
                  your brand kit — your logo on the slide, your hex codes, your fonts — and hands
                  back finished PNGs. If your OpenAI account is not verified for images, or the
                  minute&rsquo;s image allowance runs out, that slide falls back to the canvas
                  renderer so the deck is always complete.
                </p>
              </section>

              <section className="card2">
                <h4>Render quality</h4>
                <p className="sub">
                  Applied to every newly rendered carousel slide. A seven-slide deck is seven
                  images, so this is the setting that decides what a carousel costs — start on
                  Low while you are learning, move up when a deck is going out.
                </p>
                <div className="qgrid">
                  {QUALITY.map(function (q) {
                    return (
                      <button key={q[0]}
                        className={'qcard' + ((brand.imageQuality || 'medium') === q[0] ? ' on' : '')}
                        onClick={function () { set('imageQuality', q[0]); }}>
                        <b>{q[1]}</b><span>{q[2]}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="card2">
                <h4>Slide rules</h4>
                <ul className="rules">
                  <li>Cover slide uses the dark background with your accent gradient.</li>
                  <li>Body slides use the light background with dark type.</li>
                  <li>Headlines cap at 8 words — the voice rules apply to design too.</li>
                  <li>Burmese text wraps by character, so nothing runs off the slide.</li>
                  <li>Your brand name sits on every slide, with a progress bar in the accent.</li>
                </ul>
              </section>

              <div className="drawer-foot">
                <button className="btn primary" onClick={onSaveBrand} disabled={saving}>
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            </>
          ) : null}

          {/* ---------------- DOCUMENTS ---------------- */}
          {tab === 'docs' ? (
            <>
              <section className="card2">
                <h4>Add a source document</h4>
                <p className="sub">
                  Upload files or paste a brief, an offer, an ICP or a research note. Each document
                  becomes its own node on the brain, linked to any note it mentions by name.
                </p>
                <div
                  className="drop"
                  onClick={function () { docRef.current && docRef.current.click(); }}
                  onDragOver={function (e) { e.preventDefault(); }}
                  onDrop={function (e) { e.preventDefault(); addDocFiles(e.dataTransfer.files); }}
                >
                  <span className="dropico">⬆</span>
                  <b>{busy === 'docs' ? 'Saving…' : 'Drop documents here, or browse'}</b>
                  <span>.md, .markdown, .txt or .csv — each file lands as its own node</span>
                </div>
                <input ref={docRef} type="file" multiple accept=".md,.markdown,.txt,.csv" style={{ display: 'none' }}
                  onChange={function (e) { addDocFiles(e.target.files); }} />
              </section>

              <div className="orline"><span>or write one</span></div>

              <section className="card2">
                <label className="fld"><span className="lbl">Document title</span>
                  <input type="text" value={docTitle} placeholder="e.g. ICP profile"
                    onChange={function (e) { setDocTitle(e.target.value); }} /></label>
                <label className="fld"><span className="lbl">Content</span>
                  <textarea rows={7} value={docBody} placeholder="Write or paste the knowledge the AI should use…"
                    onChange={function (e) { setDocBody(e.target.value); }} /></label>
                <button className="btn primary" onClick={writeDoc}
                  disabled={busy === 'docs' || !docTitle.trim() || !docBody.trim()}>
                  Save document
                </button>
              </section>

              <section className="card2">
                <div className="card2-h">
                  <h4>Added documents</h4>
                  <span className="tag">{docs.length}</span>
                </div>
                {!docs.length ? (
                  <p className="sub">No source documents yet. Everything you add here shows up in this list.</p>
                ) : (
                  <ul className="doclist">
                    {docs.map(function (d) {
                      return (
                        <li key={d.id}>
                          <span>
                            <b>{d.title}</b>
                            <em>{Math.max(1, Math.round(d.size / 1000))} KB · {new Date(d.addedAt).toLocaleDateString()}</em>
                          </span>
                          <button onClick={function () { removeDoc(d.id); }} aria-label="Remove">✕</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
