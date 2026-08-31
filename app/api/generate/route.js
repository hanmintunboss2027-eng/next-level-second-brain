import { readJson, KEYS } from '../../../lib/store';
import { pickNotes, trimForContext } from '../../../lib/retrieve';
import { buildSystemPrompt, FORMATS } from '../../../lib/prompt';
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

  const vault = await readJson(KEYS.vault, null);
  const brand = await readJson(KEYS.brand, {});
  const notes = (vault && vault.notes) || [];

  const picked = pickNotes(notes, instruction, 14);
  const context = trimForContext(picked, 42000);
  const system = buildSystemPrompt(brand, context, format);
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
        max_tokens: 2200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: instruction }
        ]
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

  return Response.json({
    ok: true,
    content: content,
    model: model,
    used: picked.map(function (n) { return n.path; }),
    vaultCount: notes.length,
    format: format || 'auto'
  });
}
