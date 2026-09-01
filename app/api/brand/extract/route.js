import { checkAccess, denied } from '../../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

/* Looks at the reference images and writes the parts of the brand kit that
   a colour picker cannot see: the tone, the feel, the typography, and the
   things this brand should never do. Colours are handled in the browser. */
const ASK = [
  'You are a brand director studying the images below. They are examples the',
  'owner of this business chose because the work looks like what they want.',
  '',
  'Describe the SYSTEM that repeats across them, not the mood of any one image.',
  'Say what you actually see. If the images disagree, describe the dominant one',
  'and say so in "feel". Never invent a company name or a claim.',
  '',
  'Reply with JSON only, no prose, no code fence, exactly these keys:',
  '{',
  '  "tone": "how the writing should sound, 1 sentence",',
  '  "feel": "the visual system in 1-2 sentences: layout, spacing, imagery, edges",',
  '  "headingFont": "a real font name that matches, or the closest common one",',
  '  "bodyFont": "a real font name that pairs with it",',
  '  "useMore": "3-5 concrete devices to repeat, comma separated",',
  '  "neverUse": "3-5 things that would break this look, comma separated"',
  '}'
].join('\n');

export async function POST(request) {
  if (!checkAccess(request)) return denied();

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return Response.json({
      error:
        'The colours were read from your images already. The rest needs an ' +
        'OpenAI key: Vercel > your project > Environment Variables > OPENAI_API_KEY, then Redeploy.'
    }, { status: 400 });
  }

  let images = [];
  try {
    const body = await request.json();
    images = (body && Array.isArray(body.images) ? body.images : [])
      .filter(function (u) { return typeof u === 'string' && u; })
      .slice(0, 4);
  } catch (err) {
    return Response.json({ error: 'Could not read the request.' }, { status: 400 });
  }

  if (!images.length) {
    return Response.json({ error: 'Add at least one reference image first.' }, { status: 400 });
  }

  const content = [{ type: 'text', text: ASK }].concat(images.map(function (url) {
    return { type: 'image_url', image_url: { url: url, detail: 'low' } };
  }));

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: content }]
      })
    });

    const data = await res.json();
    if (!res.ok) {
      const m = (data && data.error && data.error.message) || 'the request was refused';
      if (res.status === 401) {
        return Response.json({ error: 'The OpenAI key was rejected. Check it and redeploy.' }, { status: 400 });
      }
      if (res.status === 429) {
        return Response.json({ error: 'OpenAI is out of quota or rate limiting. Add credit and try again.' }, { status: 400 });
      }
      if (/model/i.test(m)) {
        return Response.json({
          error: 'This model cannot see images. Set OPENAI_MODEL to gpt-4o-mini and redeploy.'
        }, { status: 400 });
      }
      return Response.json({ error: 'OpenAI said: ' + m }, { status: 400 });
    }

    const raw = data.choices && data.choices[0] && data.choices[0].message
      && data.choices[0].message.content;
    let out = {};
    try { out = JSON.parse(raw || '{}'); } catch (e) {
      return Response.json({ error: 'The reply was not readable. Try again.' }, { status: 502 });
    }

    const pick = ['tone', 'feel', 'headingFont', 'bodyFont', 'useMore', 'neverUse'];
    const clean = {};
    pick.forEach(function (k) {
      if (typeof out[k] === 'string' && out[k].trim()) clean[k] = out[k].trim().slice(0, 600);
    });

    return Response.json({ ok: true, fields: clean });
  } catch (err) {
    console.error('reference read failed', err);
    return Response.json({ error: 'Could not reach OpenAI: ' + err.message }, { status: 502 });
  }
}
