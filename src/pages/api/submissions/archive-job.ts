import type { APIRoute } from 'astro';
import { isCommunityArchiveUrl } from '../../../lib/community-archive.mjs';
import { cleanText, idPattern, noStoreJson, submissionDb, submissionToken } from '../../../lib/submissions.mjs';

export const prerender = false;
function authorized(request: Request, locals: unknown) {
  const token = submissionToken(locals);
  return typeof token === 'string' && token.length >= 32 && request.headers.get('authorization') === `Bearer ${token}`;
}
export const GET: APIRoute = async ({ request, locals }) => {
  if (!authorized(request, locals)) return noStoreJson({ error: 'Unauthorized.' }, 401);
  const db = submissionDb(locals);
  if (!db) return noStoreJson({ error: 'Submission database unavailable.' }, 503);
  const now = Date.now();
  try {
    const result = await db.prepare("SELECT id FROM student_submissions WHERE status = 'approved' AND (archive_state = 'queued' OR (archive_state = 'failed' AND archive_retry_at <= ?) OR (archive_state = 'uploading' AND archive_claimed_at < ?)) ORDER BY submitted_at ASC LIMIT 20").bind(now, now - 60 * 60 * 1000).all();
    return noStoreJson({ ids: (result.results || []).map(row => row.id) });
  } catch { return noStoreJson({ error: 'Archive queue unavailable.' }, 503); }
};
export const POST: APIRoute = async ({ request, locals }) => {
  if (!authorized(request, locals)) return noStoreJson({ error: 'Unauthorized.' }, 401);
  const db = submissionDb(locals);
  if (!db) return noStoreJson({ error: 'Submission database unavailable.' }, 503);
  let body: Record<string, unknown>;
  try { body = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); } catch { return noStoreJson({ error: 'Invalid request.' }, 400); }
  const id = body.id, action = body.action;
  if (typeof id !== 'string' || !idPattern.test(id)) return noStoreJson({ error: 'Invalid review ID.' }, 400);
  const now = Date.now();
  try {
    if (action === 'retry') {
      const result = await db.prepare("UPDATE student_submissions SET archive_state = 'queued', archive_retry_at = 0, archive_error = '' WHERE id = ? AND status = 'approved' AND archive_state = 'failed'").bind(id).run();
      return result.meta?.changes ? noStoreJson({ id, archiveState: 'queued' }) : noStoreJson({ error: 'Archive job is not retryable.' }, 409);
    }
    if (action === 'claim') {
      const claim = crypto.randomUUID();
      const result = await db.prepare("UPDATE student_submissions SET archive_state = 'uploading', archive_claim = ?, archive_claimed_at = ?, archive_attempts = archive_attempts + 1, archive_error = '' WHERE id = ? AND status = 'approved' AND (archive_state = 'queued' OR (archive_state = 'failed' AND archive_retry_at <= ?) OR (archive_state = 'uploading' AND archive_claimed_at < ?))").bind(claim, now, id, now, now - 60 * 60 * 1000).run();
      if (!result.meta?.changes) return noStoreJson({ error: 'Archive job is not available.' }, 409);
      const row = await db.prepare('SELECT id, grade, subject, resource_type AS resourceType, discord_id AS discord, reddit_id AS reddit, public_ids_opt_in AS publicIdsOptIn, file_name AS fileName, content_type AS contentType, file_size AS fileSize, submitted_at AS submittedAt, reviewed_at AS reviewedAt, archive_attempts AS archiveAttempts FROM student_submissions WHERE id = ? AND archive_claim = ?').bind(id, claim).first();
      return noStoreJson({ claim, submission: row });
    }
    const claim = body.claim;
    if (typeof claim !== 'string' || !idPattern.test(claim)) return noStoreJson({ error: 'Invalid archive claim.' }, 400);
    if (action === 'complete') {
      const url = body.url;
      if (typeof url !== 'string' || !isCommunityArchiveUrl(url, id)) return noStoreJson({ error: 'Invalid Archive URL.' }, 400);
      const result = await db.prepare("UPDATE student_submissions SET archive_state = 'archived', archive_url = ?, archived_at = ?, archive_claim = '', archive_error = '' WHERE id = ? AND archive_claim = ? AND archive_state = 'uploading' AND status = 'approved'").bind(url, now, id, claim).run();
      return result.meta?.changes ? noStoreJson({ id, archiveState: 'archived', archiveUrl: url }) : noStoreJson({ error: 'Archive claim expired.' }, 409);
    }
    if (action === 'fail') {
      const error = cleanText(body.error || 'Archive upload failed.', 180);
      if (error === null) return noStoreJson({ error: 'Invalid error text.' }, 400);
      const result = await db.prepare("UPDATE student_submissions SET archive_state = 'failed', archive_error = ?, archive_retry_at = ?, archive_claim = '' WHERE id = ? AND archive_claim = ? AND archive_state = 'uploading' AND status = 'approved'").bind(error, now + 5 * 60 * 1000, id, claim).run();
      return result.meta?.changes ? noStoreJson({ id, archiveState: 'failed' }) : noStoreJson({ error: 'Archive claim expired.' }, 409);
    }
    return noStoreJson({ error: 'Invalid action.' }, 400);
  } catch { return noStoreJson({ error: 'Archive job unavailable.' }, 503); }
};
