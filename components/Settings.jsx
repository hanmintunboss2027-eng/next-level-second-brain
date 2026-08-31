'use client';

import { useRef, useState } from 'react';

const SWATCHES = [
  ['accent', 'Accent — enter first'],
  ['support', 'Support'],
  ['dark', 'Dark background'],
  ['light', 'Light background'],
  ['neutral', 'Neutral']
];

function isHex(v) {
  return /^#?[0-9a-fA-F]{6}$/.test(String(v || '').trim());
}
function norm(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  return s[0] === '#' ? s : '#' + s;
}

export default function Settings({ open, onClose, brand, onBrandChange, onSaveBrand,
  vault, onUploaded, headers, readiness, saving }) {
  const [tab, setTab] = useState('vault');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  function set(key, value) {
    onBrandChange(Object.assign({}, brand, { [key]: value }));
  }
  function setColor(key, value) {
    onBrandChange(Object.assign({}, brand, {
      colors: Object.assign({}, brand.colors, { [key]: value })
    }));
  }

  async function upload(file) {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/vault/upload', { method: 'POST', body: fd, headers: headers });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: 'bad', text: data.error || 'Upload failed.' });
      } else {
        setMsg({ kind: 'ok', text: data.count + ' notes imported.' });
        onUploaded();
      }
    } catch (err) {
      setMsg({ kind: 'bad', text: 'Upload failed: ' + err.message });
    }
    setBusy(false);
  }

  return (
    <div className="backdrop" onClick={function (e) { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="Knowledge and settings">
        <div className="modal-head">
          <h3 style={{ flex: 1 }}>Knowledge &amp; Settings</h3>
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="tabs">
          <button className={tab === 'vault' ? 'on' : ''} onClick={function () { setTab('vault'); }}>Second brain</button>
          <button className={tab === 'brand' ? 'on' : ''} onClick={function () { setTab('brand'); }}>Brand kit</button>
        </div>

        {tab === 'vault' ? (
          <div className="modal-body">
            <p className="sub" style={{ marginBottom: 16 }}>
              Zip the <span className="mono">Second-Brain</span> folder you built in Part 1 and drop it
              here. Folder paths and <span className="mono">[[wiki links]]</span> are kept, so your graph
              comes across intact.
            </p>

            <div
              className="drop"
              onClick={function () { fileRef.current && fileRef.current.click(); }}
              onDragOver={function (e) { e.preventDefault(); }}
              onDrop={function (e) {
                e.preventDefault();
                upload(e.dataTransfer.files && e.dataTransfer.files[0]);
              }}
            >
              <b>{busy ? 'Importing…' : 'Upload vault'}</b>
              <span>Drop <span className="mono">Second-Brain.zip</span> here, or click to choose it</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.md,.markdown,.txt"
              style={{ display: 'none' }}
              onChange={function (e) { upload(e.target.files && e.target.files[0]); }}
            />

            {msg ? (
              <div className={'note ' + (msg.kind === 'ok' ? 'ok' : 'bad')}>
                <b>{msg.kind === 'ok' ? 'Imported' : 'Did not work'}</b>
                <p>{msg.text}</p>
              </div>
            ) : null}

            {vault && !vault.empty ? (
              <div className="stats">
                <div className="stat"><b>{vault.count}</b><span>notes</span></div>
                <div className="stat"><b>{(vault.graph && vault.graph.links.length) || 0}</b><span>links</span></div>
                <div className="stat"><b>{vault.orphans || 0}</b><span>unlinked</span></div>
              </div>
            ) : (
              <div className="note warn">
                <b>Nothing loaded yet</b>
                <p>Until you upload your vault, the AI has no knowledge of your business and will say so.</p>
              </div>
            )}

            {vault && vault.storage === 'memory' ? (
              <div className="note warn">
                <b>No storage attached</b>
                <p>
                  This deployment has no Blob Store, so anything you upload is lost on the next restart.
                  Open your project on Vercel ▸ <b>Storage</b> ▸ <b>Add</b> next to Blob Store ▸ Redeploy.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="modal-body">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <span className="lbl" style={{ margin: 0 }}>Brand readiness</span>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{readiness}%</span>
            </div>
            <div className="meter"><span style={{ width: readiness + '%' }} /></div>
            <p className="sub" style={{ marginBottom: 18 }}>
              Copy these straight out of <span className="mono">Brand/look.md</span> from Part 1.
              Nothing to re-decide.
            </p>

            <div className="field">
              <span className="lbl">Business name</span>
              <input type="text" value={brand.name || ''} onChange={function (e) { set('name', e.target.value); }} placeholder="Next Level by HMT" />
            </div>

            <div className="field">
              <span className="lbl">Language it writes in</span>
              <input type="text" value={brand.language || ''} onChange={function (e) { set('language', e.target.value); }} placeholder="Burmese" />
              <div className="hint">Say &ldquo;Burmese&rdquo; here or everything comes out in English.</div>
            </div>

            <div className="field">
              <span className="lbl">Tone and rhythm</span>
              <textarea rows={3} value={brand.tone || ''} onChange={function (e) { set('tone', e.target.value); }}
                placeholder="Plain everyday Burmese. Short sentences, one idea per line. Direct, practical, teacher-first. Technical terms stay in English." />
            </div>

            <div className="field">
              <span className="lbl">Use more of</span>
              <textarea rows={2} value={brand.useMore || ''} onChange={function (e) { set('useMore', e.target.value); }}
                placeholder="Client numbers, real examples, questions that earn a reply" />
            </div>

            <div className="field">
              <span className="lbl">Never use</span>
              <textarea rows={2} value={brand.neverUse || ''} onChange={function (e) { set('neverUse', e.target.value); }}
                placeholder="Paste section 7 of Raw/voice-print.md here — the things you would never say" />
            </div>

            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <span className="lbl">Heading font</span>
                <input type="text" value={brand.headingFont || ''} onChange={function (e) { set('headingFont', e.target.value); }} placeholder="Sora" />
              </div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}>
                <span className="lbl">Body font</span>
                <input type="text" value={brand.bodyFont || ''} onChange={function (e) { set('bodyFont', e.target.value); }} placeholder="Manrope" />
              </div>
            </div>

            <div className="field">
              <span className="lbl">Colour system</span>
              <div className="swatches">
                {SWATCHES.map(function (s) {
                  const key = s[0];
                  const val = (brand.colors && brand.colors[key]) || '';
                  const ok = isHex(val);
                  return (
                    <label className="sw" key={key}>
                      <i style={{ background: ok ? norm(val) : 'transparent' }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="n">{s[1]}</span>
                        <input
                          type="text"
                          value={val}
                          onChange={function (e) { setColor(key, e.target.value); }}
                          onBlur={function (e) { setColor(key, e.target.value ? norm(e.target.value) : ''); }}
                          placeholder="#0B2450"
                        />
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="hint">Real hex codes only. The accent is the first one it reaches for.</div>
            </div>

            <div className="field">
              <span className="lbl">Brand feel — 3 to 5 words</span>
              <input type="text" value={brand.feel || ''} onChange={function (e) { set('feel', e.target.value); }} placeholder="direct · practical · teacher-first · no hype" />
            </div>

            <button className="btn primary" onClick={onSaveBrand} disabled={saving}>
              {saving ? 'Saving…' : 'Save brand kit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
