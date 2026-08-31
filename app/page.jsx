'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Graph from '../components/Graph';
import Settings from '../components/Settings';

const FORMATS = [
  ['', 'Auto'],
  ['post', 'Text post'],
  ['carousel', 'Carousel'],
  ['image', 'Image post'],
  ['reel', 'Reel script'],
  ['newsletter', 'Newsletter'],
  ['longform', 'Long-form']
];

const EXAMPLES = [
  'ကျွန်တော့် offer အကြောင်း Facebook post တစ်ခု မြန်မာလို ရေးပေးပါ',
  'What are my three strongest proof points?',
  'ဒီအပတ် တင်သင့်တဲ့ အကြောင်းအရာ ၅ ခု စာရင်းပေးပါ',
  'Write a carousel about the mistake my industry keeps making'
];

const CODE_KEY = 'nlsb.code';

export default function Page() {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [gateError, setGateError] = useState('');

  const [vault, setVault] = useState(null);
  const [brand, setBrand] = useState({ colors: {} });
  const [readiness, setReadiness] = useState(0);
  const [saving, setSaving] = useState(false);

  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [format, setFormat] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const headers = useMemo(function () {
    return code ? { 'x-access-code': code } : {};
  }, [code]);

  /* remember the access code for this browser only */
  useEffect(function () {
    try {
      const saved = window.localStorage.getItem(CODE_KEY);
      if (saved) setCode(saved);
    } catch (err) { /* private mode — carry on without it */ }
  }, []);

  const loadStatus = useCallback(async function (withCode) {
    try {
      const res = await fetch('/api/status', {
        headers: withCode ? { 'x-access-code': withCode } : {},
        cache: 'no-store'
      });
      const data = await res.json();
      setStatus(data);
      return data;
    } catch (err) {
      setStatus({ gate: false, unlocked: true, hasKey: false, storage: 'memory' });
      return null;
    }
  }, []);

  const loadAll = useCallback(async function () {
    try {
      const [v, b] = await Promise.all([
        fetch('/api/vault', { headers: headers, cache: 'no-store' }).then(function (r) { return r.json(); }),
        fetch('/api/brand', { headers: headers, cache: 'no-store' }).then(function (r) { return r.json(); })
      ]);
      if (v && !v.error) setVault(v);
      if (b && b.brand) { setBrand(b.brand); setReadiness(b.readiness || 0); }
    } catch (err) { /* the dashboard still renders without these */ }
  }, [headers]);

  useEffect(function () { loadStatus(code); }, [code, loadStatus]);

  useEffect(function () {
    if (status && status.unlocked) loadAll();
  }, [status, loadAll]);

  async function unlock(e) {
    e.preventDefault();
    setGateError('');
    const data = await loadStatus(codeInput);
    if (data && data.unlocked) {
      setCode(codeInput);
      try { window.localStorage.setItem(CODE_KEY, codeInput); } catch (err) { /* ignore */ }
    } else {
      setGateError('That code is not right.');
    }
  }

  async function saveBrand() {
    setSaving(true);
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ brand: brand })
      });
      const data = await res.json();
      if (data && data.brand) { setBrand(data.brand); setReadiness(data.readiness || 0); }
    } catch (err) { /* the note below tells them if it did not stick */ }
    setSaving(false);
  }

  async function run() {
    if (!instruction.trim() || running) return;
    setRunning(true);
    setError('');
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ instruction: instruction, format: format })
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || 'Something went wrong.');
      else setResult(data);
    } catch (err) {
      setError('Could not reach the server. Try again.');
    }
    setRunning(false);
  }

  function copy() {
    if (!result || !result.content) return;
    navigator.clipboard.writeText(result.content).then(function () {
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 1800);
    }, function () { /* clipboard blocked — the text is on screen anyway */ });
  }

  /* ---------- access gate ---------- */
  if (status && status.gate && !status.unlocked) {
    return (
      <div className="gate">
        <form className="card" onSubmit={unlock}>
          <img src="/mark.png" alt="Next Level by HMT" />
          <h3>Your Second Brain</h3>
          <p className="sub" style={{ marginBottom: 16 }}>Enter your access code to open it.</p>
          <input
            type="password"
            value={codeInput}
            onChange={function (e) { setCodeInput(e.target.value); }}
            placeholder="Access code"
            autoFocus
          />
          {gateError ? <div className="note bad"><b>No</b><p>{gateError}</p></div> : null}
          <button className="btn primary" style={{ marginTop: 14, width: '100%' }} type="submit">Open</button>
        </form>
      </div>
    );
  }

  const notesCount = vault && !vault.empty ? vault.count : 0;
  const linkCount = vault && vault.graph ? vault.graph.links.length : 0;

  return (
    <>
      <header className="top">
        <div className="top-in">
          <span className="logo">
            <img src="/mark.png" alt="" />
            <span><b>NEXT LEVEL</b><s>BY HMT</s></span>
          </span>
          <span className="chip">AI Second Brain</span>
          <span className="spacer" />
          <button className="btn" onClick={function () { setOpen(true); }}>Settings</button>
        </div>
      </header>

      <main className="shell">

        {status && !status.hasKey ? (
          <div className="note bad" style={{ marginTop: 20 }}>
            <b>No API key</b>
            <p>
              Your site is live but it cannot think yet. Open your project on Vercel ▸ <b>Settings</b> ▸
              <b> Environment Variables</b>, add <span className="mono">OPENAI_API_KEY</span> with your key
              pasted on its own — no quotes, no spaces — then <b>Redeploy</b>.
            </p>
          </div>
        ) : null}

        <div className="cols">

          {/* ---------- left: ask ---------- */}
          <section className="card">
            <h3>Tell it what you need</h3>
            <p className="sub" style={{ marginBottom: 14 }}>
              Plain language. It reads your own notes, applies your brand kit, and writes in your voice.
            </p>

            <textarea
              rows={4}
              value={instruction}
              onChange={function (e) { setInstruction(e.target.value); }}
              onKeyDown={function (e) {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run();
              }}
              placeholder="ဥပမာ — ကျွန်တော့် offer အကြောင်း Facebook post တစ်ခု မြန်မာလို ရေးပေးပါ"
            />

            <div className="formats">
              {FORMATS.map(function (f) {
                return (
                  <button
                    key={f[0] || 'auto'}
                    className={'fchip' + (format === f[0] ? ' on' : '')}
                    onClick={function () { setFormat(f[0]); }}
                    type="button"
                  >{f[1]}</button>
                );
              })}
            </div>

            <div className="row">
              <button className="btn primary" onClick={run} disabled={running || !instruction.trim()}>
                {running ? 'Working…' : 'Generate'}
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                {notesCount ? notesCount + ' notes loaded' : 'No notes loaded yet'}
                {status && status.model ? ' · ' + status.model : ''}
              </span>
            </div>

            {!notesCount ? (
              <div className="note warn">
                <b>Empty brain</b>
                <p>Open <b>Settings ▸ Second brain</b> and upload your Part 1 folder as a zip. Until then it
                has nothing of yours to write from.</p>
              </div>
            ) : null}

            {error ? (
              <div className="note bad"><b>Did not work</b><p>{error}</p></div>
            ) : null}

            {result ? (
              <>
                <div className="out">{result.content}</div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
                  <button className="btn" onClick={run}>Try again</button>
                </div>
                {result.used && result.used.length ? (
                  <div className="sources">Read from: {result.used.join(' · ')}</div>
                ) : null}
              </>
            ) : (
              <div className="out empty">
                {EXAMPLES.map(function (x, i) {
                  return (
                    <span key={i} style={{ display: 'block', marginBottom: 6 }}>
                      <button
                        className="fchip"
                        type="button"
                        onClick={function () { setInstruction(x); }}
                        style={{ textAlign: 'left' }}
                      >{x}</button>
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---------- right: brain ---------- */}
          <aside>
            <section className="card">
              <h3>Your brain</h3>
              <p className="sub">Everything it knows about your business.</p>
              <div className="stats">
                <div className="stat"><b>{notesCount}</b><span>notes</span></div>
                <div className="stat"><b>{linkCount}</b><span>links</span></div>
                <div className="stat"><b>{readiness}%</b><span>brand ready</span></div>
              </div>
              <Graph graph={vault && vault.graph} />
              {vault && vault.updatedAt ? (
                <p className="sources" style={{ marginTop: 10 }}>
                  Last upload {new Date(vault.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </section>

            <section className="card" style={{ marginTop: 18 }}>
              <h3>Brand kit</h3>
              <div className="meter"><span style={{ width: readiness + '%' }} /></div>
              <p className="sub">
                {readiness >= 88
                  ? 'Filled in. Every post and image uses your colours and your tone.'
                  : 'Fill this in once and nothing comes out generic again.'}
              </p>
              <button className="btn" style={{ marginTop: 12 }} onClick={function () { setOpen(true); }}>
                Open Brand kit
              </button>
            </section>
          </aside>
        </div>
      </main>

      <Settings
        open={open}
        onClose={function () { setOpen(false); }}
        brand={brand}
        onBrandChange={setBrand}
        onSaveBrand={saveBrand}
        saving={saving}
        readiness={readiness}
        vault={vault}
        headers={headers}
        onUploaded={loadAll}
      />
    </>
  );
}
