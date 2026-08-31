import { gateEnabled, checkAccess } from '../../../lib/auth';
import { storageMode } from '../../../lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Tells the browser what is and is not set up, so the dashboard can show a
   real diagnosis instead of a blank screen. Deliberately returns no secrets. */
export async function GET(request) {
  return Response.json({
    gate: gateEnabled(),
    unlocked: checkAccess(request),
    hasKey: Boolean((process.env.OPENAI_API_KEY || '').trim()),
    model: (process.env.OPENAI_MODEL || 'gpt-4o-mini').trim(),
    storage: storageMode()
  });
}
