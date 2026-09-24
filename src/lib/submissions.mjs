export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const receiptPattern = /^[a-f0-9]{64}$/;
export const idPattern = /^[a-f0-9-]{36}$/;

export function submissionDb(locals) { return locals?.runtime?.env?.ANALYTICS_DB || null; }
export function submissionBucket(locals) { return locals?.runtime?.env?.SUBMISSIONS_BUCKET || null; }
export function submissionToken(locals) { return locals?.runtime?.env?.SUBMISSIONS_ADMIN_TOKEN || null; }

export function cleanText(value, max, required = false) {
  if (typeof value !== 'string') return null;
  const result = value.trim().replace(/\s+/g, ' ');
  if (result.length > max || /[\x00-\x1f\x7f]/.test(result) || (required && !result)) return null;
  return result;
}

export function safeFileName(name) {
  if (typeof name !== 'string') return null;
  const result = name.normalize('NFKC').replace(/[\\/]/g, '_').trim();
  if (!result || result.length > 150 || /[\x00-\x1f\x7f]/.test(result)) return null;
  return result;
}

export function detectFileType(bytes) {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6)))) return 'image/gif';
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return null;
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function clientHash(ip, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return origin === new URL(request.url).origin;
}

export function noStoreJson(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
