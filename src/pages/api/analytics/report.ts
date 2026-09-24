import type { APIRoute } from 'astro';
import { analyticsDb, analyticsReport } from '../../../lib/analytics.mjs';
import { flattenCatalog } from '../../../lib/resource-catalog.mjs';
import catalog from '../../../../public/data/resource-catalog.json';
import cisce from '../../../../public/data/cisce-resources.json';

export const prerender = false;
const names = new Map([...Object.values(catalog.classes).flatMap(sections => Object.values(sections).flatMap(section => flattenCatalog(section))), ...flattenCatalog(cisce)].map(file => [file.id, file.name]));
export const GET: APIRoute = async ({ request, locals }) => {
  const env = (locals as typeof locals & { runtime?: { env?: Record<string, unknown> } }).runtime?.env;
  const token = env?.ANALYTICS_ADMIN_TOKEN;
  if (typeof token !== 'string' || token.length < 32 || request.headers.get('authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 });
  const db = analyticsDb(locals);
  if (!db) return new Response('Analytics database is not configured', { status: 503 });
  try {
    const report = await analyticsReport(db);
    return Response.json({ ...report, files: report.files.map(file => ({ ...file, name: names.get(file.id) || 'Removed resource' })) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return new Response('Analytics report unavailable', { status: 503 }); }
};
