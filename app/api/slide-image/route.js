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

const SIZE = '1024x1024';   /* square — the feed's own shape */

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

function artDirection(brand, slide, total, title, textless) {
  const c = (brand && brand.colors) || {};
  const palette = ['accent', 'support', 'dark', 'light', 'neutral']
    .filter(function (k) { return c[k]; })
    .map(function (k) { return k + ' ' + c[k]; }).join(', ');

  /* The deck needs a system, not seven unrelated pictures. Cover carries the
     brand colour, the middle runs light so the deck breathes, the last slide
     comes back to the brand colour to close it. */
  const role = total === 1 ? 'single'
    : slide.n === 1 ? 'cover'
      : slide.n === total ? 'closing'
        : 'body';

  const L = [];

  /* The same route draws a seven-slide deck and a one-off image post. Telling
     the model it is making "slide 1 of 1" invites it to draw deck furniture —
     page numbers, a cover treatment for a thing with no second page. */
  L.push(total > 1
    ? ('Art-direct and typeset ONE finished square 1:1 social carousel slide — slide ' +
      slide.n + ' of ' + total + ' of a deck titled "' + title + '".')
    : ('Art-direct and typeset ONE finished square 1:1 social image post titled "' +
      title + '". It stands alone — there is no deck around it.'));
  L.push('');
  L.push('STANDARD: this is professional brand work by a senior graphic designer for a paying client. Editorial poster discipline — Swiss/international typographic style, Pentagram-grade restraint. It must look art-directed, expensive and adult. It is NOT a school project, NOT a template, NOT clip art.');
  L.push('');

  if (textless) {
    /* The words are set afterwards, in a real Myanmar font, over the lower half
       of this artwork. Asking for them here would only get a confident
       approximation of Burmese that reads as gibberish to anyone who speaks
       it. */
    L.push('=== NO TEXT — THIS IS ARTWORK ONLY ===');
    L.push('Put NO words, letters, numbers, glyphs, captions, labels, logos, wordmarks, watermarks or signatures anywhere in this image. Not one character. The words are typeset separately afterwards.');
    L.push('It is about "' + (slide.headline || title) + '" — but express that with the picture alone.');
    L.push('Compose it so the LOWER HALF is quiet and uncluttered — a plain colour field, an even shadow, or the soft out-of-focus part of the photograph — because a headline will be set over it. Keep the subject in the upper half or to one side.');
    L.push('');
  } else {
    L.push('=== THE TEXT (set exactly, nothing added, nothing translated, nothing invented) ===');
    L.push('Headline: ' + slide.headline);
    (slide.lines || []).forEach(function (l) { L.push('Supporting line: ' + l); });
    L.push('Do not put any other words on the slide. No captions, no labels, no invented taglines, no lorem ipsum, no watermark, no signature.');
    L.push('');
  }

  if (!textless) {
  L.push('=== TYPOGRAPHY ===');
  L.push('One dominant idea per slide. The headline is enormous — it should occupy roughly a third of the canvas and be legible as a thumbnail. Set it tight: leading close to the cap height, optical kerning, no letter-spacing on large sizes.');
  L.push('Supporting lines are far smaller — about a fifth of the headline size — in a lighter weight, left-aligned to the exact same margin as the headline. Two or three lines maximum.');
  L.push('Strong hierarchy through SIZE and WEIGHT only. Never centre everything, never stretch or condense the type, never outline it, never put a drop shadow, glow, bevel or gradient on any letter.');
  if (brand && (brand.headingFont || brand.bodyFont)) {
    L.push('Type feel — headline like ' + (brand.headingFont || 'a confident modern grotesque') +
      ', supporting text like ' + (brand.bodyFont || 'a clean neutral sans') + '.');
  } else {
    L.push('Type feel — a confident modern grotesque for the headline, a clean neutral sans beneath it.');
  }
  L.push('');
  }

  L.push('=== LAYOUT ===');
  L.push('Build on a strict margin grid: a generous, equal margin on all four sides — about 8% of the canvas — and nothing ever breaks it except a deliberate full-bleed colour field or photograph.');
  L.push('Leave a lot of empty space. Emptiness is the luxury signal; crowding is what makes design look amateur. Roughly half the slide should carry nothing at all.');
  L.push('Anchor the composition: type block in one clear zone, image or colour field in another. No floating decorations scattered around the edges.');
  L.push('');

  L.push('=== COLOUR ===');
  if (palette) {
    L.push('Use ONLY these brand colours: ' + palette + ', plus white and near-black. No other hue anywhere on the slide.');
  } else {
    L.push('Use a disciplined two-colour palette plus white and near-black. No other hues.');
  }
  L.push('Flat, confident colour fields. No rainbow, no candy colours, no neon gradients, no soft pastel blends.');
  L.push(role === 'single'
    ? 'This one picture has to do the whole job: a full-bleed field of the brand colour or near-black with the type reversed out of it, or a single strong photograph with the type set cleanly over its quietest area. It is the scroll-stopper and the close at once.'
    : role === 'cover'
    ? 'COVER: a full-bleed field of the brand colour or near-black, type reversed out of it. This is the scroll-stopper — the boldest slide in the deck.'
    : role === 'closing'
      ? 'CLOSING SLIDE: return to the brand colour, calmer than the cover, with the call to action given room and the brand lockup allowed to breathe.'
      : 'BODY SLIDE: mostly white or a very pale neutral with dark type, so the deck has rhythm between the bold ends. Use the brand colour only as a small accent.');
  L.push('');

  L.push('=== IMAGERY — READ THIS TWICE ===');
  L.push('If the slide carries an image it must be ONE of exactly two things:');
  L.push('  (a) real, high-end studio product photography — the actual physical product or material, sharp, soft directional light, shallow depth of field, honest colour, the way a premium brand shoots a catalogue; or');
  L.push('  (b) a single restrained geometric device — one large circle, one diagonal band, one framed crop — in a brand colour.');
  L.push(slide.art ? 'Subject to picture: ' + slide.art + '.' : 'If nothing specific is needed, use a pure colour field and let the typography carry the slide.');
  L.push('');
  L.push('ABSOLUTELY FORBIDDEN — these are what make a slide look childish, and any one of them ruins the work:');
  L.push('cartoon or comic illustration; mascots; flat-vector illustrated people with simplified faces; stick figures; clip art; doodles; hand-drawn sketches; emoji; sticker or badge shapes scattered as decoration; rainbows; stars; sparkles; smiley faces; sad faces; speech bubbles; 3D plastic toy renders; blobby organic shapes; drop shadows; bevels; glows; page curls; ribbons; starbursts; multiple unrelated decorative objects floating in the composition.');
  L.push('If a human is shown at all, it is a real photograph of a real adult, not an illustration.');
  L.push('');

  L.push('=== BRAND ===');
  if (textless) {
    L.push('No logo, no mark, no brand name — the lockup is applied afterwards.');
  } else if (brand && brand.name && role !== 'body') {
    L.push('Place the supplied logo small and quiet in one corner — about 8% of the canvas width, well inside the margin. Reproduce it exactly as supplied; do not redraw it, restyle it, recolour it, or retype any words inside it. It identifies the work; it never competes with the headline.');
  } else if (role === 'body') {
    L.push('No logo and no brand mark on this slide. A designer signs the cover and the closing slide, not every page — the deck is identified by its type and colour, not by a repeated badge.');
  }
  if (brand && brand.feel) L.push('Brand character: ' + brand.feel + '.');
  if (total > 1 && !textless) {
    L.push('Set a small, discreet slide number "' + slide.n + '/' + total + '" in the opposite corner, in the smallest type on the slide.');
  }
  L.push('');
  L.push('Deliver it as a flat finished graphic filling the whole square canvas edge to edge — not a mockup, not a device frame, not a photo of a screen, not a page with a border around it.');

  return L.join('\n');
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
  /* Burmese headlines come back as gibberish from every image model there is,
     so for those the client asks for artwork only and sets the type itself. */
  const textless = Boolean(body && body.textless);
  const prompt = artDirection(brand, slide, total, title, textless);

  /* The logo rides along only on the cover and the closing slide. Asking the
     image model to redraw a mark five more times is five more chances for it to
     mangle the wordmark — and a designer would not stamp a badge on every page
     anyway. It also keeps the account's images-per-minute budget for the slides
     that actually need it. */
  const marked = !textless && (slide.n === 1 || slide.n === total);
  const logo = marked ? dataUrlToFile(brand.logoUrl, 'logo') : null;

  function send() {
    if (logo) {
      const form = new FormData();
      form.append('model', model);
      form.append('size', SIZE);
      form.append('quality', quality);
      form.append('input_fidelity', 'high');
      form.append(
        'prompt',
        prompt + '\n\nThe attached image is the brand\'s own logo mark. Place it in ' +
        'the corner lockup at small size and reproduce it pixel-faithfully — do not ' +
        'redraw it, do not restyle it, do not recolour it, and do not re-typeset any ' +
        'words inside it. If you cannot reproduce it exactly, leave it out entirely ' +
        'rather than approximating it.'
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
