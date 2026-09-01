'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Graph from '../components/Graph';
import Settings from '../components/Settings';
import OrgChart, { LEAVES, ROLES } from '../components/OrgChart';

const EXAMPLES = [
  'ကျွန်တော့် offer အကြောင်း Facebook post တစ်ခု မြန်မာလို ရေးပေးပါ',
  'What are my three strongest proof points?',
  'ဒီအပတ် တင်သင့်တဲ့ အကြောင်းအရာ ၅ ခု စာရင်းပေးပါ',
  'Write a carousel about the mistake my industry keeps making'
];

const CODE_KEY = 'nlsb.code';

const STEPS = [
  { at: 0, lit: ['ceo'], label: 'CEO reading your brain' },
  { at: 700, lit: ['ceo', 'cmo'], label: 'CMO briefing the job' },
  { at: 1300, lit: ['ceo', 'cmo', 'research'], label: 'Research pulling the angle' },
  { at: 1900, lit: ['ceo', 'cmo', 'research', 'content'], label: 'Content writing in your voice' }
];

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
  const [role, setRole] = useState('ceo');
  const [running, setRunning] = useState(false);
  const [lit, setLit] = useState([]);
  const [step, setStep] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState('');

  const timers = useRef([]);

  const headers = useMemo(function () {
    return code ? { 'x-access-code': code } : {};
  }, [code]);

  useEffect(function () {
    try {
      const saved = window.localStorage.getItem(CODE_KEY);
      if (saved) setCode(saved);
    } catch (err) { /* private mode */ }
  }, []);

  /* clock — set on the client only, so the server render never mismatches */
  useEffect(function () {
    function tick() {
      const d = new Date();
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const mons = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const p = function (n) { return String(n).padStart(2, '0'); };
      setNow(days[d.getDay()] + ', ' + mons[d.getMonth()] + ' ' + p(d.getDate()) +
        '   ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()));
    }
    tick();
    const id = setInterval(tick, 1000);
    return function () { clearInterval(id); };
  }, []);

  useEffect(function () {
    return function () { timers.current.forEach(clearTimeout); };
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
    } catch (err) { /* dashboard still renders */ }
  }, [headers]);

  useEffect(function () { loadStatus(code); }, [code, loadStatus]);
  useEffect(function () { if (status && status.unlocked) loadAll(); }, [status, loadAll]);

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
    } catch (err) { /* handled by the note below */ }
    setSaving(false);
  }

  async function run() {
    if (!instruction.trim() || running) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setRunning(true);
    setError('');
    setResult(null);
    setCopied(false);

    STEPS.forEach(function (s) {
      timers.current.push(setTimeout(function () {
        setLit(s.lit);
        setStep(s.label);
      }, s.at));
    });
    const leafKey = format || 'post';
    timers.current.push(setTimeout(function () {
      setLit(['ceo', 'cmo', 'research', 'content', 'leaf', 'leaf:' + leafKey]);
      setStep('Producing the deliverable');
    }, 2500));

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ instruction: instruction, format: format })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setLit([]);
      } else {
        setResult(data);
        setLit(['ceo', 'cmo', 'research', 'content', 'leaf', 'leaf:' + leafKey]);
      }
    } catch (err) {
      setError('Could not reach the server. Try again.');
      setLit([]);
    }
    setStep('');
    setRunning(false);
  }

  function copy() {
    if (!result || !result.content) return;
    navigator.clipboard.writeText(result.content).then(function () {
      setCopied(true);
      setTimeout(function () { setCopied(false); }, 1800);
    }, function () { /* clipboard blocked; text is on screen */ });
  }

  /* ---------- access gate ---------- */
  if (status && status.gate && !status.unlocked) {
    return (
      <div className="gate">
        <form className="panel" onSubmit={unlock} style={{ padding: 28 }}>
          <img src="/mark.png" alt="Next Level by HMT" />
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>Your Second Brain</h3>
          <p className="sub" style={{ marginBottom: 18 }}>Enter your access code to open it.</p>
          <input
            type="password"
            value={codeInput}
            onChange={function (e) { setCodeInput(e.target.value); }}
            placeholder="Access code"
            autoFocus
          />
          {gateError ? <div className="note bad"><b>No</b><p>{gateError}</p></div> : null}
          <button className="btn primary" style={{ marginTop: 16, width: '100%', justifyContent: 'center' }} type="submit">
            Open
          </button>
        </form>
      </div>
    );
  }

  const notesCount = vault && !vault.empty ? vault.count : 0;
  const linkCount = vault && vault.graph ? vault.graph.links.length : 0;
  const activeRole = ROLES[role] || ROLES.ceo;
  const formatLabel = format
    ? (LEAVES.filter(function (l) { return l.key === format; })[0] || {}).label
    : 'Auto';

  const pill = running
    ? { cls: 'statuspill live', text: step || 'Running' }
    : result
      ? { cls: 'statuspill done', text: 'Run complete' }
      : { cls: 'statuspill', text: 'Standby' };

  return (
    <>
      <header className="top">
        <div className="top-in">
          <span className="logo">
            <img src="/mark.png" alt="" />
            <span><b>SECOND BRAIN</b><s>NEXT LEVEL BY HMT</s></span>
          </span>
          <span className="spacer" />
          <span className="clock">{now}</span>
          <button className="btn" onClick={function () { setOpen(true); }}>Settings</button>
        </div>
      </header>

      <main className="shell">

        {/* ---------------- left: the organization ---------------- */}
        <section>
          <div className="seclab">
            Organization
            <span className="rule" />
            <span className={pill.cls}><i />{pill.text}</span>
          </div>

          <div className="stage">
            <OrgChart
              lit={lit}
              format={format}
              onFormat={setFormat}
              role={role}
              onRole={setRole}
            />
          </div>

          {status && !status.hasKey ? (
            <div className="note bad">
              <b>No API key</b>
              <p>
                Your site is live but it cannot think yet. Open your project on Vercel ▸ Settings ▸
                Environment Variables, add <code>OPENAI_API_KEY</code> with the key pasted on its own —
                no quotes, no spaces — then Redeploy.
              </p>
            </div>
          ) : null}

          <div className="cmd">
            <span className="caret">›</span>
            <textarea
              rows={1}
              value={instruction}
              onChange={function (e) {
                setInstruction(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
              }}
              onKeyDown={function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); }
              }}
              placeholder="Tell the CEO what you need. It routes the rest."
            />
            <button className="send" onClick={run} disabled={running || !instruction.trim()} title="Send">
              {running ? '•' : '↑'}
            </button>
          </div>

          <div className="cmdhint">
            <span>FORMAT <b>{formatLabel}</b></span>
            <span>BRAIN <b>{notesCount} notes</b></span>
            <span>MODEL <b>{(status && status.model) || '—'}</b></span>
            <span>ENTER to send · SHIFT+ENTER for a new line</span>
          </div>

          {!notesCount ? (
            <div className="note warn">
              <b>Empty brain</b>
              <p>Open <b>Settings ▸ Second brain</b> and upload your Part 1 folder as a zip. Until then it
              has nothing of yours to write from.</p>
            </div>
          ) : null}

          {error ? <div className="note bad"><b>Did not work</b><p>{error}</p></div> : null}

          <div className="examples">
            {EXAMPLES.map(function (x, i) {
              return (
                <button className="ex" key={i} type="button" onClick={function () { setInstruction(x); }}>
                  {x}
                </button>
              );
            })}
          </div>
        </section>

        {/* ---------------- right: brain + output ---------------- */}
        <aside className="side">

          <div className="panel">
            <div className="panel-h">
              <h3>Knowledge</h3>
              <span className="tag">Constellation</span>
            </div>
            <div className="constellation">
              <Graph graph={vault && vault.graph} />
            </div>
            <div className="stats">
              <div className="stat"><b>{notesCount}</b><span>notes</span></div>
              <div className="stat"><b>{linkCount}</b><span>links</span></div>
              <div className="stat"><b>{readiness}%</b><span>brand</span></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">
              <h3>{result ? 'Deliverable' : running ? 'Running' : activeRole.name}</h3>
              <span className="tag">{result ? (result.format || 'auto') : running ? 'live' : 'role'}</span>
            </div>
            <div className="panel-b">
              {running ? (
                <div className="runlog">
                  {STEPS.map(function (s) {
                    const done = lit.length > s.lit.length;
                    const cur = step === s.label;
                    return (
                      <div className={'runrow' + (cur ? ' on' : done ? ' did' : '')} key={s.label}>
                        <i />{s.label}
                      </div>
                    );
                  })}
                  <div className={'runrow' + (step === 'Producing the deliverable' ? ' on' : '')}>
                    <i />Producing the deliverable
                  </div>
                </div>
              ) : result ? (
                <>
                  <div className="out">{result.content}</div>
                  <div className="row" style={{ marginTop: 14 }}>
                    <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
                    <button className="btn" onClick={run}>Run again</button>
                  </div>
                  {result.used && result.used.length ? (
                    <div className="sources">Read from: {result.used.join(' · ')}</div>
                  ) : null}
                </>
              ) : (
                <div className="roleinfo">
                  <b>{activeRole.name}</b>
                  <p>{activeRole.blurb}</p>
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">
              <h3>Brand kit</h3>
              <span className="tag">{readiness}% ready</span>
            </div>
            <div className="panel-b">
              <div className="meter"><span style={{ width: readiness + '%' }} /></div>
              <p className="sub">
                {readiness >= 88
                  ? 'Filled in. Every post and image uses your colours and your tone.'
                  : 'Fill this in once and nothing comes out generic again.'}
              </p>
              <button className="btn" style={{ marginTop: 14 }} onClick={function () { setOpen(true); }}>
                Open Brand kit
              </button>
            </div>
          </div>

        </aside>
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
