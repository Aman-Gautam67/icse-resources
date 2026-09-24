import type { APIRoute } from 'astro';
import { submissionDb } from '../../../lib/submissions.mjs';

export const prerender = false;
export const GET: APIRoute = async ({ locals, url }) => {
  const db = submissionDb(locals);
  if (!db) return Response.json({ resources: [] }, { headers: { 'Cache-Control': 'no-store' } });
  const grade = url.searchParams.get('class');
  if (grade && !['10', '12'].includes(grade)) return Response.json({ resources: [] }, { status: 400 });
  try {
    const result = await db.prepare(`SELECT id, grade, subject, resource_type AS resourceType, file_name AS fileName, content_type AS contentType, submitted_at AS submittedAt FROM student_submissions WHERE status = 'approved' AND (? IS NULL OR grade = ?) ORDER BY reviewed_at DESC LIMIT 200`).bind(grade ? Number(grade) : null, grade ? Number(grade) : null).all();
    return Response.json({ resources: result.results || [] }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch { return Response.json({ error: 'Resources unavailable.' }, { status: 503 }); }
};
