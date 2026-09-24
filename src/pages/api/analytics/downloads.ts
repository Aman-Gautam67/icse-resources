import type { APIRoute } from 'astro';
import { analyticsDb, RETENTION_MS, visitorPattern } from '../../../lib/analytics.mjs';
import { flattenCatalog } from '../../../lib/resource-catalog.mjs';
import catalog from '../../../../public/data/resource-catalog.json';
import cisce from '../../../../public/data/cisce-resources.json';

export const prerender = false;
const names = new Map([...Object.values(catalog.classes).flatMap(sections => Object.values(sections).flatMap(section => flattenCatalog(section))), ...flattenCatalog(cisce)].map(file => [file.id, file.name]));
export const GET: APIRoute = async ({ request, locals, url }) => {
  const env = (locals as typeof locals & { runtime?: { env?: Record<string, unknown> } }).runtime?.env;
  const token = env?.ANALYTICS_ADMIN_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || request.headers.get('authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 });
  const visitor = url.searchParams.get('visitor') || '';
  if (!visitorPattern.test(visitor)) return new Response('Invalid browser ID', { status: 400 });
  const db = analyticsDb(locals);
  if (!db) return new Response('Analytics database is not configured', { status: 503 });
  try {
    const result = await db.prepare(`SELECT file_id AS fileId, created_at AS requestedAt FROM analytics_events WHERE event_type = 'download' AND visitor_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 500`).bind(visitor, Date.now() - RETENTION_MS).all();
    return Response.json({ downloads: (result.results || []).map(item => ({ ...item, name: names.get(item.fileId) || 'Removed resource' })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response('Download history unavailable', { status: 503 }); }
};
