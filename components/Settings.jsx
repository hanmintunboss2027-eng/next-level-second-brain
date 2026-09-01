'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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

function isHex(v) { return /^#?[0-9a-fA-F]{6}$/.test(String(v || '').trim()); }
function norm(v) {
  const s = String(v || '').trim();
  return s ? (s[0] === '#' ? s : '#' + s) : '';
}

export default function Settings({ open, onClose, brand, onBrandChange, onSaveBrand,
  vault, onUploaded, headers, readiness, saving }) {
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

  async function uploadAsset(file, slot) {
    if (!file) return;
    setBusy(slot); setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slot', slot);
      const res = await fetch('/api/assets', { method: 'POST', body: fd, headers: headers });
      const data = await res.json();
      if (!res.ok) { setMsg({ kind: 'bad', text: data.error || 'Upload failed.' }); }
      else if (slot === 'reference') {
        const next = (brand.references || []).concat([data.url]).slice(0, 4);
        set('references', next);
      } else {
        set(slot === 'face' ? 'faceUrl' : 'logoUrl', data.url);
      }
    } catch (err) { setMsg({ kind: 'bad', text: 'Upload failed: ' + err.message }); }
    setBusy('');
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
  const blobOn = vault && vault.storage === 'blob';

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
            <div className={'note ' + (msg.kind === 'ok' ? 'ok' : 'bad')}>
              <b>{msg.kind === 'ok' ? 'Done' : 'Did not work'}</b><p>{msg.text}</p>
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
                    <p>Anything you upload is lost on the next restart. Vercel ▸ <b>Storage</b> ▸
                    <b> Add</b> next to Blob Store ▸ Redeploy.</p>
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
                <p className="sub">Use clean, high-resolution PNG, JPG or WebP files.</p>
                <div className="assets">
                  <button className="asset" onClick={function () { faceRef.current && faceRef.current.click(); }}>
                    {brand.faceUrl ? <img src={brand.faceUrl} alt="" /> : <span className="ph">＋</span>}
                    <b>Founder face</b>
                    <span>{busy === 'face' ? 'Uploading…' : brand.faceUrl ? 'Replace' : 'Upload'}</span>
                  </button>
                  <button className="asset" onClick={function () { logoRef.current && logoRef.current.click(); }}>
                    {brand.logoUrl ? <img src={brand.logoUrl} alt="" /> : <span className="ph">＋</span>}
                    <b>Logo mark</b>
                    <span>{busy === 'logo' ? 'Uploading…' : brand.logoUrl ? 'Replace' : 'Upload'}</span>
                  </button>
                </div>
                <input ref={faceRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={function (e) { uploadAsset(e.target.files && e.target.files[0], 'face'); }} />
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={function (e) { uploadAsset(e.target.files && e.target.files[0], 'logo'); }} />
              </section>

              <section className="card2">
                <h4>Visual reference lab</h4>
                <p className="sub">Up to four great examples. The AI reads the recurring system, not just the mood.</p>
                <div className="refs">
                  {(brand.references || []).map(function (u, i) {
                    return (
                      <span className="ref" key={i}>
                        <img src={u} alt="" />
                        <button onClick={function () {
                          set('references', (brand.references || []).filter(function (_, j) { return j !== i; }));
                        }} aria-label="Remove">✕</button>
                      </span>
                    );
                  })}
                  {(brand.references || []).length < 4 ? (
                    <button className="ref add" onClick={function () { refRef.current && refRef.current.click(); }}>
                      {busy === 'reference' ? '…' : '＋'}
                      <span>Add reference</span>
                    </button>
                  ) : null}
                </div>
                <input ref={refRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={function (e) { uploadAsset(e.target.files && e.target.files[0], 'reference'); }} />
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
                  The Content agent writes structured slides, then each slide is rendered on canvas
                  using your exact hex codes, your fonts and your brand name — ready to download as PNG.
                </p>
              </section>

              <section className="card2">
                <h4>Render quality</h4>
                <p className="sub">Applied to every newly rendered carousel slide.</p>
                <div className="qgrid">
                  {QUALITY.map(function (q) {
                    return (
                      <button key={q[0]}
                        className={'qcard' + ((brand.imageQuality || 'high') === q[0] ? ' on' : '')}
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
