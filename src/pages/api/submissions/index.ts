import type { APIRoute } from 'astro';
import { clientHash, cleanText, detectFileType, MAX_FILE_SIZE, noStoreJson, safeFileName, sameOrigin, sha256, submissionBucket, submissionDb, submissionToken } from '../../../lib/submissions.mjs';

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  if (!sameOrigin(request)) return noStoreJson({ error: 'Request origin rejected.' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data;')) return noStoreJson({ error: 'Choose a file and complete the form.' }, 415);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_FILE_SIZE + 16_384) return noStoreJson({ error: 'Maximum file size is 20 MB.' }, 413);
  const db = submissionDb(locals), bucket = submissionBucket(locals), secret = submissionToken(locals);
  if (!db || !bucket || typeof secret !== 'string' || secret.length < 32) return noStoreJson({ error: 'Sharing is temporarily unavailable.' }, 503);
  let form: FormData;
  try {
    if (!request.body) throw new Error('Empty upload');
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_FILE_SIZE + 16_384) { await reader.cancel(); return noStoreJson({ error: 'Maximum file size is 20 MB.' }, 413); }
      chunks.push(value);
    }
    const body = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': request.headers.get('content-type') || '' }, body }).formData();
  } catch { return noStoreJson({ error: 'Invalid upload.' }, 400); }
  const grade = String(form.get('grade') || '');
  const subject = cleanText(form.get('subject'), 80, true);
  const resourceType = cleanText(form.get('resourceType'), 120, true);
  const discord = cleanText(form.get('discord') ?? '', 80);
  const reddit = cleanText(form.get('reddit') ?? '', 80);
  const publicIdsOptIn = form.get('publicIdsOptIn') === 'on' ? 1 : 0;
  const file = form.get('file');
  if (!['10', '12'].includes(grade) || subject === null || resourceType === null || discord === null || reddit === null || !(file instanceof File)) return noStoreJson({ error: 'Check class, subject, description and file.' }, 400);
  const fileName = safeFileName(file.name);
  if (!fileName || file.size < 1 || file.size > MAX_FILE_SIZE) return noStoreJson({ error: 'Choose a non-empty image or PDF under 20 MB.' }, 400);
  const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const contentType = detectFileType(signature);
  if (!contentType) return noStoreJson({ error: 'Only PDF, JPEG, PNG, GIF and WebP files are accepted.' }, 415);
  const extension = fileName.toLowerCase().split('.').pop();
  const extensions: Record<string, string[]> = { 'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'], 'image/gif': ['gif'], 'image/webp': ['webp'] };
  if (!extensions[contentType].includes(extension || '')) return noStoreJson({ error: 'File extension does not match its contents.' }, 415);
  const ip = request.headers.get('cf-connecting-ip') || '';
  if (!ip) return noStoreJson({ error: 'Sharing is temporarily unavailable.' }, 503);
  const now = Date.now(), windowStart = Math.floor(now / 3_600_000) * 3_600_000;
  try {
    const hash = await clientHash(ip, secret);
    await db.prepare('INSERT OR IGNORE INTO student_submission_limits (client_hash, window_start, attempts) VALUES (?, ?, 0)').bind(hash, windowStart).run();
    const limit = await db.prepare('UPDATE student_submission_limits SET attempts = attempts + 1 WHERE client_hash = ? AND window_start = ? AND attempts < 5').bind(hash, windowStart).run();
    if (!limit.meta?.changes) return noStoreJson({ error: 'Upload limit reached. Try again later.' }, 429);
    if (Math.random() < 0.01) await db.prepare('DELETE FROM student_submission_limits WHERE window_start < ?').bind(windowStart - 86_400_000).run().catch(() => {});
  } catch { return noStoreJson({ error: 'Sharing is temporarily unavailable.' }, 503); }
  const id = crypto.randomUUID(), receipt = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `pending/${id}`;
  try {
    await bucket.put(key, file.stream(), { httpMetadata: { contentType } });
    await db.prepare('INSERT INTO student_submissions (id, receipt_hash, grade, subject, resource_type, discord_id, reddit_id, public_ids_opt_in, file_name, content_type, file_size, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, await sha256(receipt), Number(grade), subject, resourceType, discord, reddit, publicIdsOptIn, fileName, contentType, file.size, now).run();
    return noStoreJson({ receipt, status: 'pending', id }, 201);
  } catch {
    await bucket.delete(key).catch(() => {});
    return noStoreJson({ error: 'Upload failed. Please try again.' }, 503);
  }
};
