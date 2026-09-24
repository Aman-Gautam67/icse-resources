import type { APIRoute } from 'astro';
import { idPattern, submissionBucket, submissionDb, submissionToken } from '../../../lib/submissions.mjs';

export const prerender = false;
export const GET: APIRoute = async ({ request, locals, url }) => {
  const token = submissionToken(locals);
  if (typeof token !== 'string' || token.length < 32 || request.headers.get('authorization') !== `Bearer ${token}`) return new Response('Unauthorized', { status: 401 });
  const id = url.searchParams.get('id') || '';
  if (!idPattern.test(id)) return new Response('Not found', { status: 404 });
  const db = submissionDb(locals), bucket = submissionBucket(locals);
  if (!db || !bucket) return new Response('Unavailable', { status: 503 });
  try {
    const row = await db.prepare('SELECT file_name AS fileName, content_type AS contentType FROM student_submissions WHERE id = ?').bind(id).first();
    if (!row) return new Response('Not found', { status: 404 });
    const object = await bucket.get(`pending/${id}`);
    if (!object) return new Response('Not found', { status: 404 });
    const asciiName = String(row.fileName).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
    return new Response(object.body, { headers: { 'Content-Type': String(row.contentType), 'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(String(row.fileName))}`, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': 'sandbox', 'Cache-Control': 'no-store' } });
  } catch { return new Response('Unavailable', { status: 503 }); }
};
