import { readJson, KEYS } from '../../../lib/store';
import { checkAccess, denied } from '../../../lib/auth';

/* One carousel slide, designed.

   The slide text is written by the Content agent; this route turns that text
   into an actual designed image with the image model, using the brand kit as
   the art direction — the logo, the palette, the fonts, the product photos the
   person uploaded. That is the difference between a carousel you can post and
   a carousel you have to redraw in Canva first.

   If the brand kit has a logo or reference photos we go through /images/edits,
   which lets the model see them and put the real mark on the slide. With no
   assets we fall back to /images/generations. If either fails the client falls
   back to the canvas renderer, so a run never dies here. */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const SIZE = '1024x1536';

function dataUrlToFile(url, name) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(url || ''));
  if (!m) return null;
  const type = m[1] || 'image/png';
  if (!/^image\//.test(type)) return null;
  let buf;
  try {
    buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'utf8');
  } catch (err) { return null; }
  if (!buf.length || buf.length > 8 * 1024 * 1024) return null;
  const ext = type.indexOf('png') >= 0 ? 'png' : type.indexOf('webp') >= 0 ? 'webp' : 'jpg';
  return new File([buf], name + '.' + ext, { type: type });
}

function artDirection(brand, slide, total, title) {
  const c = (brand && brand.colors) || {};
  const palette = ['accent', 'support', 'dark', 'light', 'neutral']
    .filter(function (k) { return c[k]; })
    .map(function (k) { return k + ' ' + c[k]; }).join(', ');

  const lines = [];
  lines.push(
    'Design one finished social media carousel slide, portrait 4:5, slide ' +
    slide.n + ' of ' + total + ' in a deck titled "' + title + '".'
  );
  lines.push('This is a real published marketing graphic, not a mockup, not a device frame, not a photo of a screen. Fill the whole canvas edge to edge.');
  lines.push('');
  lines.push('TEXT THAT MUST APPEAR ON THE SLIDE, spelled exactly as written, nothing added and nothing translated:');
  lines.push('Headline: ' + slide.headline);
  (slide.lines || []).forEach(function (l) { lines.push('Body line: ' + l); });
  lines.push('');
  lines.push('Typography: the headline is the largest thing on the slide and must be instantly readable at thumbnail size. Body lines are much smaller and sit under it. Render every character precisely — this text is in the brand language and may be Burmese script, so reproduce the glyphs exactly as given and do not substitute Latin letters.');
  if (brand && (brand.headingFont || brand.bodyFont)) {
    lines.push('Typeface feel — headings like ' + (brand.headingFont || 'a strong grotesque') +
      ', body like ' + (brand.bodyFont || 'a clean sans') + '.');
  }
  lines.push('');
  if (palette) lines.push('Use ONLY this brand palette: ' + palette + '. No other hues.');
  if (brand && brand.feel) lines.push('Brand feel: ' + brand.feel + '.');
  if (brand && brand.name) {
    lines.push('Put the brand name "' + brand.name + '"' +
      (brand.tagline ? ' with the small tagline "' + brand.tagline + '"' : '') +
      ' in a small lockup in the top-left corner.');
  }
  if (slide.art) lines.push('Imagery on this slide: ' + slide.art + '.');
  lines.push(
    slide.n === 1
      ? 'This is the cover: boldest type, strongest colour, made to stop the scroll.'
      : slide.n === total
        ? 'This is the last slide: the call to action, calm and clear, with the brand lockup given room.'
        : 'This is a body slide: keep it calmer than the cover so the deck has rhythm.'
  );
  lines.push('No watermark. No stock-photo look. No lorem ipsum. No extra text beyond what is listed above.');
  return lines.join('\n');
}

export async function POST(request) {
  if (!checkAccess(request)) return denied();

  const key = (process.env.OPENAI_API_KEY || '').trim();
  if (!key) return Response.json({ error: 'No OpenAI key.' }, { status: 400 });

  let body;
  try { body = await request.json(); }
  catch (err) { return Response.json({ error: 'Bad request.' }, { status: 400 }); }

  const slide = (body && body.slide) || null;
  if (!slide || !(slide.headline || (slide.lines && slide.lines.length))) {
    return Response.json({ error: 'Nothing to draw.' }, { status: 400 });
  }
  const total = Math.max(1, Number(body.total) || 1);
  const title = String(body.title || 'Carousel').slice(0, 140);

  const brand = await readJson(KEYS.brand, {});
  const model = (process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1').trim();
  const quality = ['low', 'medium', 'high'].indexOf(brand.imageQuality) >= 0
    ? brand.imageQuality : 'medium';
  const prompt = artDirection(brand, slide, total, title);

  /* Only the logo goes in. A new OpenAI account is allowed a handful of input
     images per minute, and a seven-slide deck spends that budget in seconds —
     so the brand mark is worth an attachment and nothing else is. */
  const logo = dataUrlToFile(brand.logoUrl, 'logo');

  function send() {
    if (logo) {
      const form = new FormData();
      form.append('model', model);
      form.append('size', SIZE);
      form.append('quality', quality);
      form.append('input_fidelity', 'high');
      form.append(
        'prompt',
        prompt + '\n\nThe attached image is the brand\'s own logo mark. Reproduce ' +
        'it faithfully in the corner lockup — do not redraw, restyle or recolour it.'
      );
      form.append('image[]', logo, logo.name);
      return fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + key },
        body: form
      });
    }
    return fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({ model: model, prompt: prompt, size: SIZE, quality: quality, n: 1 })
    });
  }

  /* A rate limit is a queue, not a failure: OpenAI says how long to wait, so
     wait that long and go again rather than handing the person a broken slide. */
  let res = null;
  let detail = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      res = await send();
    } catch (err) {
      console.error('image request failed', err);
      return Response.json({ error: 'Could not reach the image model.' }, { status: 502 });
    }
    if (res.ok) break;

    detail = '';
    try { const j = await res.json(); detail = (j && j.error && j.error.message) || ''; }
    catch (err) { /* not json */ }
    console.error('image model said', res.status, detail);

    if (res.status !== 429 || attempt === 2) break;
    const m = /try again in ([\d.]+)\s*(ms|s)/i.exec(detail);
    let waitMs = m ? Math.ceil(parseFloat(m[1]) * (m[2].toLowerCase() === 'ms' ? 1 : 1000)) : 12000;
    waitMs = Math.min(45000, Math.max(1500, waitMs + 1500));
    await new Promise(function (r) { setTimeout(r, waitMs); });
  }

  if (!res || !res.ok) {
    if (res && (res.status === 403 || /verif/i.test(detail))) {
      return Response.json({
        error:
          'Your OpenAI account has not been verified for image generation yet. ' +
          'Open platform.openai.com ▸ Settings ▸ Organization and complete ' +
          'verification. Slides are drawn on canvas until then.'
      }, { status: 403 });
    }
    if (res && res.status === 429) {
      return Response.json({
        error: 'The image model is rate-limited right now — this slide was drawn on canvas instead.'
      }, { status: 429 });
    }
    return Response.json({ error: detail || 'The image model refused this slide.' }, { status: 502 });
  }

  const data = await res.json();
  const first = (data && data.data && data.data[0]) || {};
  const b64 = first.b64_json;
  if (!b64) {
    if (first.url) return Response.json({ ok: true, image: first.url });
    return Response.json({ error: 'The image model returned nothing.' }, { status: 502 });
  }

  return Response.json({ ok: true, image: 'data:image/png;base64,' + b64 });
}
