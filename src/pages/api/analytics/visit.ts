import type { APIRoute } from 'astro';
import { analyticsDb, readVisitor, recordEvent, validPage } from '../../../lib/analytics.mjs';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  const db = analyticsDb(locals);
  if (!db) return new Response(null, { status: 204 });
  if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new Response(null, { status: 403 });
  let page: unknown;
  try { page = (await request.json()).page; } catch { return new Response(null, { status: 400 }); }
  if (!validPage(page)) return new Response(null, { status: 400 });
  const visitorId = readVisitor(request.headers.get('cookie'));
  if (!visitorId) return new Response(null, { status: 204 });
  try {
    await recordEvent(db, { visitorId, type: 'visit', page });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response(null, { status: 503 }); }
};
