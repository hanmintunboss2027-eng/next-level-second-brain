'use client';

/* The org chart is the interface. One instruction goes to the CEO, which routes
   it down through the department to whichever format you asked for. During a run
   the path lights up so you can see what is actually happening. */

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

const I = {
  ceo: (
    <svg viewBox="0 0 24 24" color="#19C4B6" aria-hidden="true">
      <path {...S} d="M9 4.5a2.6 2.6 0 0 1 5 .4M9 4.5A2.5 2.5 0 0 0 6.6 8M9 4.5V20M14 4.9a2.5 2.5 0 0 1 3.4 3.1M6.6 8a2.6 2.6 0 0 0-.9 4.6M17.4 8a2.6 2.6 0 0 1 .9 4.6M5.7 12.6A2.7 2.7 0 0 0 7.5 17M18.3 12.6a2.7 2.7 0 0 1-1.8 4.4M7.5 17A2.5 2.5 0 0 0 12 19M16.5 17A2.5 2.5 0 0 1 12 19" />
    </svg>
  ),
  cmo: (
    <svg viewBox="0 0 24 24" color="#9B8CF0" aria-hidden="true">
      <path {...S} d="M4 10v4a1 1 0 0 0 1 1h2.6L14 19V5L7.6 9H5a1 1 0 0 0-1 1z" />
      <path {...S} d="M17.5 9.2a4 4 0 0 1 0 5.6M19.8 6.8a7.3 7.3 0 0 1 0 10.4" />
    </svg>
  ),
  research: (
    <svg viewBox="0 0 24 24" color="#5FD3F3" aria-hidden="true">
      <circle {...S} cx="7" cy="14" r="3.4" />
      <circle {...S} cx="17" cy="14" r="3.4" />
      <path {...S} d="M10.4 14h3.2M7 10.6 8.8 5.6h2.4M17 10.6 15.2 5.6h-2.4" />
    </svg>
  ),
  content: (
    <svg viewBox="0 0 24 24" color="#9B8CF0" aria-hidden="true">
      <path {...S} d="M4.5 19.5 5.7 15 16 4.7a2.1 2.1 0 0 1 3 3L8.7 18l-4.2 1.5z" />
      <path {...S} d="M14.3 6.4 17.6 9.7" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <rect {...S} x="4" y="4" width="16" height="16" rx="2.4" />
      <path {...S} d="M8 9h8M8 12.5h8M8 16h4.5" />
    </svg>
  ),
  picture: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <rect {...S} x="3.5" y="5" width="17" height="14" rx="2.4" />
      <circle {...S} cx="9" cy="10" r="1.6" />
      <path {...S} d="m4.5 17 4.3-4.2a1.6 1.6 0 0 1 2.2 0L16 17.4M14.8 13.6l1.3-1.2a1.6 1.6 0 0 1 2.2 0l1.9 1.8" />
    </svg>
  ),
  carousel: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <rect {...S} x="7.5" y="5" width="9" height="14" rx="2" />
      <path {...S} d="M4.5 8v8M19.5 8v8" />
    </svg>
  ),
  reels: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <rect {...S} x="3.5" y="6" width="12.5" height="12" rx="2.4" />
      <path {...S} d="m20.5 8.4-4.5 3.1 4.5 3.1z" />
    </svg>
  ),
  longform: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <path {...S} d="M4 5.6h11a2 2 0 0 1 2 2v10.8H6a2 2 0 0 1-2-2z" />
      <path {...S} d="M17 8.6h1.5a1.5 1.5 0 0 1 1.5 1.5v6.8a1.5 1.5 0 0 1-1.5 1.5H17M7 9h5M7 12h6M7 15h4" />
    </svg>
  ),
  newsletter: (
    <svg viewBox="0 0 24 24" color="#8FA5BF" aria-hidden="true">
      <rect {...S} x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path {...S} d="m4.5 8 6.4 4.6a2 2 0 0 0 2.2 0L19.5 8" />
    </svg>
  )
};

export const LEAVES = [
  { key: 'post', label: 'Text', icon: 'text' },
  { key: 'image', label: 'Picture', icon: 'picture' },
  { key: 'carousel', label: 'Carousel', icon: 'carousel' },
  { key: 'reel', label: 'Reels', icon: 'reels' },
  { key: 'longform', label: 'Long-form', icon: 'longform' },
  { key: 'newsletter', label: 'Newsletter', icon: 'newsletter' }
];

export const ROLES = {
  ceo: {
    name: 'CEO',
    blurb:
      'Your AI CEO reads every document in your brain and routes every marketing job. Give it one instruction and it decides what needs to happen.'
  },
  cmo: {
    name: 'CMO',
    blurb:
      'The marketing department. Holds your positioning, your message and your one customer, and briefs the work below it.'
  },
  research: {
    name: 'Research',
    blurb:
      'Finds the angle. Pulls the proof points, the objections and the beliefs out of your own notes before anything gets written.'
  },
  content: {
    name: 'Content',
    blurb:
      'Writes in your voice. Reads your voice print first, then produces whichever format the job needs — and never invents a number.'
  }
};

/* Each department reports in its own colour, so a glance at the chart tells
   you who did the work on this run without reading a word. */
const TONE = { ceo: 'teal', cmo: 'violet', research: 'cyan', content: 'violet', leaf: 'magenta' };

function Report({ tone, kicker, text, side }) {
  if (!text) return null;
  return (
    <span className={'report ' + tone + ' ' + (side || 'below')}>
      <b><i />{kicker}</b>
      <span>{text}</span>
    </span>
  );
}

export default function OrgChart({ lit, format, onFormat, onRole, role, reports }) {
  const has = function (k) { return Boolean(lit && lit.indexOf(k) >= 0); };
  const on = function (k) { return has(k) ? ' on' : ''; };
  const sel = function (k) { return role === k ? ' sel' : ''; };
  const r = reports || {};

  /* A rail is live when the work has actually reached it, and a live rail runs
     a light down its length — that travelling light is the whole reason the
     chart reads as a machine doing something rather than a diagram of one. */
  const leafOn = Boolean(lit && lit.some(function (k) { return k.indexOf('leaf:') === 0; }));

  return (
    <div className="org">

      <div className="tier">
        <span className="nodewrap wrap-ceo">
        <button
          type="button"
          className={'node ceo' + on('ceo') + sel('ceo')}
          onClick={function () { onRole('ceo'); }}
        >
          <i className="led" />
          <span className="ico">{I.ceo}</span>
          <span className="tt">
            <span className="kicker">AI CEO</span>
            <b>CEO</b>
            <span className="sub">Reads every document</span>
          </span>
        </button>
        <Report tone={TONE.ceo} kicker={r.ceoKicker || 'Working'} text={r.ceo} side="right" />
        </span>
      </div>

      <div className={'orgline' + (has('cmo') || has('research') ? ' lit' : '')} />

      <div className={'tier split' + (has('cmo') || has('research') ? ' lit' : '')}>
        <span className={'peerlink' + (has('cmo') && has('research') ? ' lit' : '')} />
        <div className={'branch' + (has('cmo') ? ' lit' : '')}>
          <span className="nodewrap">
          <button
            type="button"
            className={'node tone-violet' + on('cmo') + sel('cmo')}
            onClick={function () { onRole('cmo'); }}
          >
            <i className="led" />
          <span className="ico">{I.cmo}</span>
            <span className="tt"><b>CMO</b><span className="sub">Marketing</span></span>
          </button>
          <Report tone={TONE.cmo} kicker={r.cmoKicker || '↑ Report'} text={r.cmo} side="below out-l" />
          </span>
        </div>
        <div className={'branch' + (has('research') ? ' lit' : '')}>
          <span className="nodewrap">
          <button
            type="button"
            className={'node tone-cyan' + on('research') + sel('research')}
            onClick={function () { onRole('research'); }}
          >
            <i className="led" />
          <span className="ico">{I.research}</span>
            <span className="tt"><b>Research</b><span className="sub">Trends &amp; angles</span></span>
          </button>
          <Report tone={TONE.research} kicker={r.researchKicker || '↑ Report'} text={r.research} side="below out-r" />
          </span>
        </div>
      </div>

      <div className={'gather' + (has('content') ? ' lit' : '')} />

      <div className="tier">
        <span className="nodewrap">
        <button
          type="button"
          className={'node tone-violet' + on('content') + sel('content')}
          onClick={function () { onRole('content'); }}
        >
          <i className="led" />
          <span className="ico">{I.content}</span>
          <span className="tt"><b>Content</b><span className="sub">Posts in your voice</span></span>
        </button>
        <Report tone={TONE.content} kicker={r.contentKicker || '↑ Report'} text={r.content} side="below deep" />
        </span>
      </div>

      <div className={'orgline' + (has('leaf') ? ' lit' : '')} />

      <div className={'tier leaves' + (leafOn ? ' lit' : '')}>
        {LEAVES.map(function (l) {
          const active = (lit && lit.indexOf('leaf:' + l.key) >= 0) ? ' on' : '';
          const chosen = format === l.key ? ' sel' : '';
          return (
            <div className={'leaf-wrap' + (active ? ' lit' : '')} key={l.key}>
              <button
                type="button"
                className={'node leaf' + active + chosen}
                onClick={function () { onFormat(format === l.key ? '' : l.key); }}
                title={'Ask for a ' + l.label.toLowerCase()}
              >
                <i className="led" />
                <span className="ico">{I[l.icon]}</span>
                <b>{l.label}</b>
              </button>
              {active ? <Report tone={TONE.leaf} kicker={r.leafKicker || l.label} text={r.leaf} /> : null}
            </div>
          );
        })}
      </div>

    </div>
  );
}
