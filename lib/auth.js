/* Optional access code. Set SITE_PASSWORD and the site asks for it once.
   Leave it unset and the site is open to anyone with the link. */

export function gateEnabled() {
  return Boolean(process.env.SITE_PASSWORD);
}

export function checkAccess(request) {
  if (!gateEnabled()) return true;
  const given = request.headers.get('x-access-code') || '';
  return given === process.env.SITE_PASSWORD;
}

export function denied() {
  return new Response(
    JSON.stringify({ error: 'Wrong access code.' }),
    { status: 401, headers: { 'content-type': 'application/json' } }
  );
}
