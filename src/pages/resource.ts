import type { APIRoute } from 'astro';
import catalog from '../../public/data/resource-catalog.json';
import cisce from '../../public/data/cisce-resources.json';
import { flattenCatalog } from '../lib/resource-catalog.mjs';
import { createResourceHandler } from '../lib/resource-fallback.mjs';
import { analyticsDb, readVisitor, recordEvent } from '../lib/analytics.mjs';

export const prerender = false;
const files = [...Object.values(catalog.classes).flatMap(sections => Object.values(sections).flatMap(section => flattenCatalog(section))), ...flattenCatalog(cisce)];
const handle = createResourceHandler(files);
export const GET: APIRoute = async ({ url, request, locals }) => {
  const response = await handle(url);
  if (url.searchParams.get('mode') === 'download' && (response.status === 302 || response.status === 200) && request.headers.get('dnt') !== '1' && request.headers.get('sec-gpc') !== '1') {
    const visitorId = readVisitor(request.headers.get('cookie'));
    const db = analyticsDb(locals);
    if (visitorId && db) {
      try { await recordEvent(db, { visitorId, type: 'download', fileId: url.searchParams.get('id') || '' }); } catch { /* A metrics outage must not block a file. */ }
    }
  }
  return response;
};
