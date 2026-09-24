import type { APIRoute } from 'astro';
import { noStoreJson, receiptPattern, sameOrigin, sha256, submissionDb } from '../../../lib/submissions.mjs';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!sameOrigin(request)) return noStoreJson({ error: 'Request origin rejected.' }, 403);
  const db = submissionDb(locals);
  if (!db) return noStoreJson({ error: 'Status is temporarily unavailable.' }, 503);
  let receipts: unknown;
  try { receipts = (await request.json()).receipts; } catch { return noStoreJson({ error: 'Invalid request.' }, 400); }
  if (!Array.isArray(receipts) || receipts.length > 30 || !receipts.every(receipt => typeof receipt === 'string' && receiptPattern.test(receipt))) return noStoreJson({ error: 'Invalid tracking code.' }, 400);
  try {
    const items = await Promise.all(receipts.map(async receipt => {
      const hash = await sha256(receipt);
      const row = await db.prepare('SELECT id, grade, subject, resource_type AS resourceType, file_name AS fileName, status, submitted_at AS submittedAt, reviewed_at AS reviewedAt, rejection_reason AS rejectionReason FROM student_submissions WHERE receipt_hash = ?').bind(hash).first();
      return row ? { ...row, receipt } : null;
    }));
    return noStoreJson({ submissions: items.filter(Boolean) });
  } catch { return noStoreJson({ error: 'Status is temporarily unavailable.' }, 503); }
};
