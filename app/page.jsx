'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Graph from '../components/Graph';
import Settings from '../components/Settings';
import OrgChart, { LEAVES, ROLES } from '../components/OrgChart';
import Mic from '../components/Mic';
import Deliverable from '../components/Deliverable';

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
  const [role, setRole] = useState('ceo');
  const [running, setRunning] = useState(false);
  const [lit, setLit] = useState([]);
  const [step, setStep] = useState('');
  const [stage, setStage] = useState(null);
  const [result, setResult] = useState(null);
  const [thread, setThread] = useState([]);
  const [deliverable, setDeliverable] = useState(null);
  const [usedNotes, setUsedNotes] = useState([]);
  const [reports, setReports] = useState({});
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
      /* keep the storage badge honest after an upload or a save */
      const st = await fetch('/api/status', { headers: headers, cache: 'no-store' })
        .then(function (r) { return r.json(); }).catch(function () { return null; });
      if (st) setStatus(st);
    } catch (err) { /* dashboard still renders */ }
  }, [headers]);

  useEffect(function () { loadStatus(code); }, [code, loadStatus]);

  /* Depend on the fact of being unlocked, not on the status object: loadAll
     refreshes that object, and depending on it made the two chase each other
     round the event loop, re-fetching for ever. */
  const unlocked = !!(status && status.unlocked);
  useEffect(function () { if (unlocked) loadAll(); }, [unlocked, loadAll]);

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

  /* `next` lets the settings drawer save an image the instant it is picked,
     without waiting a render for the brand in state to catch up. */
  async function saveBrand(next) {
    const payload = next && typeof next === 'object' && !next.nativeEvent ? next : brand;
    setSaving(true);
    try {
      const res = await fetch('/api/brand', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ brand: payload })
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
    setDeliverable(null);
    setReports({});
    setCopied(false);

    const asked = instruction;
    const history = thread.map(function (m) { return { role: m.role, content: m.content }; });
    setThread(function (t) { return t.concat([{ role: 'user', content: asked }]); });
    setInstruction('');

    /* The chart narrates the run department by department: the job travels
       CEO → Research → CMO → Content → the format desk, and each one says what
       it is doing the moment it lights up. The same line shows over the
       knowledge map on the right, so the wait reads as work, not as a spinner. */
    const fmtKey = format || 'post';
    const fmtLabel = (LEAVES.filter(function (l) { return l.key === fmtKey; })[0] || {}).label || 'Text';
    const LEAFWORK = {
      post: 'Matching your voice · brand kit and knowledge notes',
      image: 'Writing the caption and the image brief',
      carousel: 'Writing and art-directing the slides',
      reel: 'Writing the script and the shot list',
      longform: 'Drafting the long-form piece',
      newsletter: 'Writing the subject line and the body'
    };
    const leafWork = LEAFWORK[fmtKey] || LEAFWORK.post;

    const LIVE = [
      { at: 0, lit: ['ceo'], tone: 'teal', label: 'CEO',
        step: 'Reading your second brain and choosing the team',
        rep: { ceoKicker: 'Route', ceo: 'Reading your second brain and choosing the team' } },
      { at: 1100, lit: ['ceo', 'research'], tone: 'cyan', label: 'Research',
        step: 'Reading your second brain for the angle',
        rep: { researchKicker: 'Read', research: 'Reading your second brain for the angle' } },
      { at: 2400, lit: ['ceo', 'research', 'cmo'], tone: 'violet', label: 'CMO',
        step: 'Briefing the job and the audience',
        rep: { cmoKicker: 'Working', cmo: 'Delegating to 1 content producer' } },
      { at: 3600, lit: ['ceo', 'research', 'cmo', 'content'], tone: 'violet', label: 'Content',
        step: 'Content is coordinating the deliverable',
        rep: { contentKicker: 'Online', content: 'Content is coordinating the deliverable' } },
      { at: 4800, lit: ['ceo', 'research', 'cmo', 'content', 'leaf', 'leaf:' + fmtKey],
        tone: 'magenta', label: fmtLabel, step: leafWork,
        rep: { leafKicker: fmtLabel, leaf: leafWork } }
    ];
    LIVE.forEach(function (s) {
      timers.current.push(setTimeout(function () {
        setLit(s.lit);
        setStep(s.step);
        setStage({ tone: s.tone, label: s.label, text: s.step });
        setReports(function (r) { return Object.assign({}, r, s.rep); });
      }, s.at));
    });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: Object.assign({ 'content-type': 'application/json' }, headers),
        body: JSON.stringify({ instruction: asked, format: format, history: history })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setLit([]);
        setStage(null);
      } else {
        /* the run finished, so stop the scripted narration overwriting the
           real reports a moment later */
        timers.current.forEach(clearTimeout);
        timers.current = [];
        const d = data.deliverable || null;
        setResult(data);
        setDeliverable(d);
        setUsedNotes(data.used || []);

        /* Only the departments that actually worked stay lit, and each shows
           what it handed over — the same way the run narrated itself. */
        const team = (d && d.team && d.team.length) ? d.team : ['cmo', 'research', 'content'];
        const key = (d && d.format) || format || 'post';
        const label = (LEAVES.filter(function (l) { return l.key === key; })[0] || {}).label || 'Text';
        setLit(['ceo'].concat(team).concat(['leaf', 'leaf:' + key]));
        setStage(null);
        setReports({
          ceoKicker: 'Working',
          ceo: (d && d.route) || "Done. The team's output is ready.",
          cmoKicker: '↑ Report',
          cmo: team.indexOf('cmo') >= 0 ? ((d && d.reports.cmo) || 'CMO → CEO: content package delivered') : '',
          researchKicker: '↑ Report',
          research: team.indexOf('research') >= 0 ? ((d && d.reports.research) || 'Research → CEO: research brief delivered') : '',
          contentKicker: '↑ Report',
          content: team.indexOf('content') >= 0 ? ((d && d.reports.content) || 'Content → CMO: all requested formats delivered') : '',
          leafKicker: '↑ Report',
          leaf: (d && d.reports.leaf) || (label + ' → Content: ' + label.toLowerCase() + ' delivered')
        });

        setThread(function (t) {
          return t.concat([{
            role: 'assistant', content: data.content,
            format: data.format, used: data.used || []
          }]);
        });

        /* The brain grows: every run is filed back into the vault, so the
           knowledge map gains a node for the work you just did. */
        if (d && d.title) {
          fetch('/api/docs', {
            method: 'POST',
            headers: Object.assign({ 'content-type': 'application/json' }, headers),
            body: JSON.stringify({
              title: 'Session — ' + d.title,
              body: [d.route, '', d.body, '', d.caption].filter(Boolean).join('\n')
            })
          }).then(function () { loadAll(); }).catch(function () { });
        }
      }
    } catch (err) {
      console.error('run failed', err);
      setError('Could not reach the server. Try again.');
      setLit([]);
      setStage(null);
    }
    setStep('');
    setRunning(false);
  }

  function copy(text, i) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      setCopied(i);
      setTimeout(function () { setCopied(false); }, 1800);
    }, function () { /* clipboard blocked; text is on screen */ });
  }

  function newChat() {
    setThread([]);
    setResult(null);
    setDeliverable(null);
    setReports({});
    setLit([]);
    setStage(null);
    setError('');
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
    ? { cls: 'statuspill live', text: 'Live run' }
    : result
      ? { cls: 'statuspill done', text: 'Complete' }
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

        {/* ---- left: the organization, filling the height ---- */}
        <section className="col-left">
          <div className="seclab">
            Organization
            <span className="rule" />
            <span className={pill.cls}><i />{pill.text}</span>
          </div>

          <div className="stagewrap">
            <div className="stage">
            <OrgChart
              lit={lit}
              format={format}
              onFormat={setFormat}
              role={role}
              onRole={setRole}
              reports={reports}
            />
            </div>
          </div>
        </section>

        <div className="divider" />

        {/* ---- right: one full-height rail — answer, then the map ---- */}
        <aside className="rail">
          {status && !status.hasKey ? (
          <div className="note bad">
          <b>No API key</b>
          <p>
          Your site is live but it cannot think yet. Open your project on Vercel and click
          <b> Environment Variables</b> in the left sidebar — it is a top-level item now, not
          inside a Settings menu. Add <code>OPENAI_API_KEY</code> with the key pasted on its
          own, no quotes and no spaces, then Redeploy.
          </p>
          </div>
          ) : null}

          {!notesCount ? (
          <div className="note warn">
          <b>Empty brain</b>
          <p>Open <b>Settings ▸ Second brain</b> and upload your Part 1 folder as a zip. Until then it
          has nothing of yours to write from.</p>
          </div>
          ) : notesCount < 4 ? (
          <div className="note warn">
          <b>Thin brain — {notesCount} note{notesCount === 1 ? '' : 's'}</b>
          <p>
          It will answer, but from almost nothing of yours, so everything will come out
          generic. Zip your whole Part 1 <code>Second-Brain</code> folder — including
          <code>Raw/voice-print.md</code>, <code>Raw/business-facts.md</code> and
          the <code>Brand/</code> folder — and upload it again under
          <b> Settings ▸ Second brain</b>.
          </p>
          </div>
          ) : null}

          {error ? <div className="note bad"><b>Did not work</b><p>{error}</p></div> : null}

          {/* One panel fills the rail. Before and during a run it is the
              knowledge map with the department currently working named under
              it; the moment the work lands it becomes the deliverable. */}
          {deliverable ? (
            <Deliverable
              d={deliverable}
              brand={brand}
              used={usedNotes}
              running={running}
              step={step}
              onCopy={copy}
              copied={copied}
            />
          ) : (
            <div className="panel stagepanel">
              <div className="constellation grow">
                <Graph graph={vault && vault.graph} />
              </div>

              {running ? (
                <div className={'livestage ' + ((stage && stage.tone) || 'teal')}>
                  <span className="ls-lab"><i />{(stage && stage.label) || 'CEO'}</span>
                  <p>{(stage && stage.text) || step || 'Working…'}</p>
                </div>
              ) : (
                <>
                  <div className="roleinfo idle">
                    <b>{activeRole.name}</b>
                    <p>{activeRole.blurb}</p>
                  </div>
                  <div className="stats thin">
                    <div className="stat"><b>{notesCount}</b><span>notes</span></div>
                    <div className="stat"><b>{linkCount}</b><span>links</span></div>
                    <div className="stat"><b>{readiness}%</b><span>brand</span></div>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        {/* ---- the command bar is docked at the bottom, as in a console ---- */}
        <div className="dock">
          {/* The examples are scaffolding for the first run. Once the chart is
              working they step aside so the format desks can report into that
              band — but the row keeps its height, because a console that
              changes shape mid-run reads as a glitch. */}
          <div className={'examples' + (running || deliverable ? ' spent' : '')}>
          {EXAMPLES.map(function (x, i) {
          return (
          <button className="ex" key={i} type="button" onClick={function () { setInstruction(x); }}>
          {x}
          </button>
          );
          })}
          </div>
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
          placeholder={running ? 'Your CEO is working…' : 'Tell the CEO what you need. It routes the rest.'}
          />
          <Mic onText={setInstruction} disabled={running} />
          <button className="send" onClick={run} disabled={running || !instruction.trim()} title="Send">
          {running ? '•' : '↑'}
          </button>
          </div>
          <div className="cmdhint">
          <span>
          FORMAT <b>{formatLabel}</b>
          {format
          ? <button className="clearfmt" type="button" onClick={function () { setFormat(''); }}>clear</button>
          : <i className="tip">click a card to force one</i>}
          </span>
          <span>BRAIN <b>{notesCount} notes</b></span>
          <span>MODEL <b>{(status && status.model) || '—'}</b></span>
          <span>ENTER to send · SHIFT+ENTER for a new line</span>
          </div>
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
        storage={(status && status.storage) || ''}
        headers={headers}
        onUploaded={loadAll}
      />
    </>
  );
}
