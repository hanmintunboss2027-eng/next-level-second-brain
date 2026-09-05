import { readJson, KEYS } from '../../../lib/store';
import { allNotes } from '../../../lib/docs';
import { pickNotes, trimForContext } from '../../../lib/retrieve';
import { buildSystemPrompt, FORMATS } from '../../../lib/prompt';
import { SHAPE_RULES, normalise } from '../../../lib/deliverable';
import { checkAccess, denied } from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  if (!checkAccess(request)) return denied();

  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key) {
    return Response.json({
      error:
        'No OpenAI key found. Add OPENAI_API_KEY in your project settings ' +
        '(Environment Variables), then redeploy.'
    }, { status: 400 });
  }
  if (!/^sk-/.test(key)) {
    return Response.json({
      error:
        'The OPENAI_API_KEY does not look like a key — it should start with "sk-". ' +
        'Check it was pasted on its own, with no quotes and no label.'
    }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return Response.json({ error: 'Bad request.' }, { status: 400 });
  }

  const instruction = String((body && body.instruction) || '').trim();
  if (!instruction) {
    return Response.json({ error: 'Type what you want first.' }, { status: 400 });
  }
  const format = FORMATS[body.format] ? body.format : '';

  /* keep a short conversation so follow-ups like "make it shorter" work */
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const turns = history
    .filter(function (m) {
      return m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string';
    })
    .map(function (m) {
      return { role: m.role, content: m.content.slice(0, 6000) };
    });

  const brand = await readJson(KEYS.brand, {});
  const bundle = await allNotes();
  const notes = bundle.notes;

  const recent = turns.map(function (m) { return m.content; }).join(' ');

  /* "Write a long-form piece" has nothing in it to retrieve on: the stop-list
     eats every word, and whatever happens to be pinned decides the subject.
     Anchoring the query with what this business actually is keeps a vague
     instruction pointed at the right shelf of the vault instead of the biggest
     file in it. */
  const anchor = [brand.name, brand.tagline, brand.useMore, brand.feel]
    .filter(Boolean).join(' ').slice(0, 400);

  const picked = pickNotes(notes, instruction + ' ' + recent.slice(0, 1200) + ' ' + anchor, 14);
  const context = trimForContext(picked, 42000);
  const system = buildSystemPrompt(brand, context, format) + '\n\n' + SHAPE_RULES;
  const model = (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim();

  let res;
  try {
    res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + key
      },
      body: JSON.stringify({
        model: model,
        temperature: 0.75,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }]
          .concat(turns)
          .concat([{ role: 'user', content: instruction }])
      })
    });
  } catch (err) {
    console.error('openai fetch failed', err);
    return Response.json({ error: 'Could not reach OpenAI. Try again in a moment.' }, { status: 502 });
  }

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j && j.error && j.error.message) || '';
    } catch (err) { /* body was not json */ }

    if (res.status === 401) {
      return Response.json({
        error:
          'OpenAI rejected the key. Open your project settings, paste the key ' +
          'again on its own (no quotes, no spaces), save, and redeploy.'
      }, { status: 401 });
    }
    if (res.status === 429 || /quota|billing|credit/i.test(detail)) {
      return Response.json({
        error:
          'The key works but there is no credit behind it. Go to ' +
          'platform.openai.com ▸ Settings ▸ Billing and add at least $5.'
      }, { status: 402 });
    }
    if (/model/i.test(detail)) {
      return Response.json({
        error:
          'The model "' + model + '" is not available on this account. Set ' +
          'OPENAI_MODEL to one you do have, then redeploy. ' + detail
      }, { status: 400 });
    }
    return Response.json({ error: detail || ('OpenAI returned ' + res.status) }, { status: 502 });
  }

  const data = await res.json();
  const content =
    (data.choices && data.choices[0] && data.choices[0].message &&
      data.choices[0].message.content) || '';

  /* A model that ignores the schema should still produce something usable,
     so the raw text becomes the body rather than an error. */
  let parsed = null;
  try { parsed = JSON.parse(content); } catch (err) { parsed = null; }
  const deliverable = normalise(parsed, content, format);

  return Response.json({
    ok: true,
    deliverable: deliverable,
    content: deliverable.body,
    model: model,
    used: picked.map(function (n) { return n.path; }),
    vaultCount: notes.length,
    format: deliverable.format
  });
}
