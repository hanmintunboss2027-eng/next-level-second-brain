'use client';

import { useEffect, useRef, useState } from 'react';

/* Speak instead of typing. Uses the browser's own speech recognition, which
   means nothing is uploaded anywhere by us. Burmese support depends on the
   browser, so the language can be switched and a failure says so plainly
   rather than looking broken. */

const LANGS = [
  { code: 'my-MM', short: 'MY' },
  { code: 'en-US', short: 'EN' }
];

export default function Mic({ onText, disabled }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [langIdx, setLangIdx] = useState(0);
  const [err, setErr] = useState('');
  const rec = useRef(null);
  const base = useRef('');

  useEffect(function () {
    const SR = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;
    setSupported(Boolean(SR));
    try {
      const saved = window.localStorage.getItem('nlsb.miclang');
      if (saved === 'en-US') setLangIdx(1);
    } catch (e) { /* ignore */ }
    return function () {
      if (rec.current) { try { rec.current.stop(); } catch (e) { /* ignore */ } }
    };
  }, []);

  function stop() {
    if (rec.current) { try { rec.current.stop(); } catch (e) { /* ignore */ } }
    setListening(false);
  }

  function start(currentText) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setErr('');
    base.current = currentText ? currentText.replace(/\s+$/, '') + ' ' : '';

    const r = new SR();
    r.lang = LANGS[langIdx].code;
    r.continuous = true;
    r.interimResults = true;

    r.onresult = function (ev) {
      let text = '';
      for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
      onText(base.current + text);
    };
    r.onerror = function (ev) {
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        setErr('Microphone blocked. Allow it in the address bar, then try again.');
      } else if (ev.error === 'language-not-supported') {
        setErr('This browser cannot do ' + LANGS[langIdx].short + ' speech. Switch to the other language.');
      } else if (ev.error !== 'aborted' && ev.error !== 'no-speech') {
        setErr('Speech stopped: ' + ev.error);
      }
      setListening(false);
    };
    r.onend = function () { setListening(false); };

    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch (e) {
      setErr('Could not start the microphone.');
    }
  }

  if (!supported) return null;

  return (
    <span className="micwrap">
      {err ? <span className="micerr">{err}</span> : null}
      <button
        type="button"
        className={'miclang' + (listening ? ' hot' : '')}
        onClick={function () {
          const next = (langIdx + 1) % LANGS.length;
          setLangIdx(next);
          try { window.localStorage.setItem('nlsb.miclang', LANGS[next].code); } catch (e) { /* ignore */ }
          if (listening) stop();
        }}
        title="Speech language"
      >{LANGS[langIdx].short}</button>
      <button
        type="button"
        className={'mic' + (listening ? ' on' : '')}
        disabled={disabled}
        onClick={function (e) {
          if (listening) { stop(); return; }
          const box = e.currentTarget.closest('.cmd');
          const ta = box ? box.querySelector('textarea') : null;
          start(ta ? ta.value : '');
        }}
        title={listening ? 'Stop listening' : 'Speak your instruction'}
        aria-pressed={listening ? 'true' : 'false'}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
}
