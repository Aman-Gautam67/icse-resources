import type { APIRoute } from 'astro';
import { cleanText, idPattern, noStoreJson, submissionDb, submissionToken } from '../../../lib/submissions.mjs';

export const prerender = false;
function authorized(request: Request, locals: unknown) {
  const token = submissionToken(locals);
  return typeof token === 'string' && token.length >= 32 && request.headers.get('authorization') === `Bearer ${token}`;
}
export const GET: APIRoute = async ({ request, locals, url }) => {
  if (!authorized(request, locals)) return noStoreJson({ error: 'Unauthorized.' }, 401);
  const db = submissionDb(locals);
  if (!db) return noStoreJson({ error: 'Submission database unavailable.' }, 503);
  const status = url.searchParams.get('status') || 'pending';
  if (!['pending', 'approved', 'rejected', 'all'].includes(status)) return noStoreJson({ error: 'Invalid status.' }, 400);
  try {
    const result = await db.prepare('SELECT id, grade, subject, resource_type AS resourceType, discord_id AS discord, reddit_id AS reddit, file_name AS fileName, content_type AS contentType, file_size AS fileSize, status, submitted_at AS submittedAt, reviewed_at AS reviewedAt, rejection_reason AS rejectionReason FROM student_submissions WHERE (? = \'all\' OR status = ?) ORDER BY submitted_at DESC LIMIT 200').bind(status, status).all();
    return noStoreJson({ submissions: result.results || [] });
  } catch { return noStoreJson({ error: 'Submission list unavailable.' }, 503); }
};
export const POST: APIRoute = async ({ request, locals }) => {
  if (!authorized(request, locals)) return noStoreJson({ error: 'Unauthorized.' }, 401);
  const db = submissionDb(locals);
  if (!db) return noStoreJson({ error: 'Submission database unavailable.' }, 503);
  let body: Record<string, unknown>;
  try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request'); } catch { return noStoreJson({ error: 'Invalid request.' }, 400); }
  const id = body.id, decision = body.decision;
  const reason = cleanText(body.reason || '', 300);
  if (typeof id !== 'string' || !idPattern.test(id) || !['approved', 'rejected'].includes(String(decision)) || reason === null) return noStoreJson({ error: 'Invalid review.' }, 400);
  try {
    const result = await db.prepare("UPDATE student_submissions SET status = ?, reviewed_at = ?, rejection_reason = ? WHERE id = ? AND (status = 'pending' OR (status = 'approved' AND ? = 'rejected'))").bind(decision, Date.now(), decision === 'rejected' ? reason : '', id, decision).run();
    if (!result.meta?.changes) return noStoreJson({ error: 'Submission was already reviewed or does not exist.' }, 409);
    return noStoreJson({ id, status: decision });
  } catch { return noStoreJson({ error: 'Review could not be saved.' }, 503); }
};
