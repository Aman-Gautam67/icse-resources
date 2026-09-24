import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as upload } from '../src/pages/api/submissions/index.ts';
import { POST as status } from '../src/pages/api/submissions/status.ts';
import { GET as approved } from '../src/pages/api/submissions/approved.ts';
import { GET as publicFile } from '../src/pages/api/submissions/file.ts';
import { GET as adminList, POST as review } from '../src/pages/api/submissions/admin.ts';
import { GET as adminFile } from '../src/pages/api/submissions/admin-file.ts';
import { detectFileType } from '../src/lib/submissions.mjs';

const base = 'https://example.test';
const adminToken = 'x'.repeat(40);
function context() {
  const rows = new Map(), files = new Map(), limits = new Map();
  const db = { prepare(sql) { let args = []; return { bind(...values) { args = values; return this; }, async run() {
    if (sql.startsWith('INSERT OR IGNORE INTO student_submission_limits')) { const key = args.join(':'); if (!limits.has(key)) limits.set(key, 0); return { meta: { changes: 1 } }; }
    if (sql.startsWith('UPDATE student_submission_limits')) { const key = args.join(':'); const count = limits.get(key) || 0; if (count >= 5) return { meta: { changes: 0 } }; limits.set(key, count + 1); return { meta: { changes: 1 } }; }
    if (sql.startsWith('DELETE FROM student_submission_limits')) return { meta: { changes: 0 } };
    if (sql.startsWith('INSERT INTO student_submissions')) { const [id, receiptHash, grade, subject, resourceType, discord, reddit, fileName, contentType, fileSize, submittedAt] = args; rows.set(id, { id, receiptHash, grade, subject, resourceType, discord, reddit, fileName, contentType, fileSize, submittedAt, status: 'pending', reviewedAt: null, rejectionReason: '' }); return { meta: { changes: 1 } }; }
    if (sql.startsWith('UPDATE student_submissions')) { const [decision, reviewedAt, rejectionReason, id] = args; const row = rows.get(id); if (!row || row.status !== 'pending' && !(row.status === 'approved' && decision === 'rejected')) return { meta: { changes: 0 } }; Object.assign(row, { status: decision, reviewedAt, rejectionReason }); return { meta: { changes: 1 } }; }
    throw Error(`Unexpected SQL: ${sql}`);
  }, async first() {
    if (sql.includes('WHERE receipt_hash = ?')) { const row = [...rows.values()].find(row => row.receiptHash === args[0]); return row ? { id: row.id, grade: row.grade, subject: row.subject, resourceType: row.resourceType, fileName: row.fileName, status: row.status, submittedAt: row.submittedAt, reviewedAt: row.reviewedAt, rejectionReason: row.rejectionReason } : null; }
    if (sql.includes("status = 'approved'")) { const row = rows.get(args[0]); return row?.status === 'approved' ? row : null; }
    if (sql.includes('WHERE id = ?')) return rows.get(args[0]) || null;
    throw Error(`Unexpected SQL: ${sql}`);
  }, async all() {
    if (sql.includes("status = 'approved'")) return { results: [...rows.values()].filter(row => row.status === 'approved' && (args[0] === null || row.grade === args[0])) };
    if (sql.includes('student_submissions WHERE')) return { results: [...rows.values()].filter(row => args[0] === 'all' || row.status === args[0]) };
    throw Error(`Unexpected SQL: ${sql}`);
  } }; } };
  const bucket = { async put(key, stream) { files.set(key, new Uint8Array(await new Response(stream).arrayBuffer())); }, async get(key) { const value = files.get(key); return value ? { body: new Response(value).body } : null; }, async delete(key) { files.delete(key); } };
  return { locals: { runtime: { env: { ANALYTICS_DB: db, SUBMISSIONS_BUCKET: bucket, SUBMISSIONS_ADMIN_TOKEN: adminToken } } }, rows, files };
}
function formRequest(file, overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({ grade: '10', subject: 'Maths', resourceType: 'Prelim paper', discord: '', reddit: 'student', ...overrides })) if (value !== undefined) form.set(key, value);
  form.set('file', file);
  return new Request(`${base}/api/submissions`, { method: 'POST', headers: { Origin: base, 'CF-Connecting-IP': '203.0.113.5' }, body: form });
}
const pdf = () => new File(['%PDF-1.7\nexample\n%%EOF'], 'paper.pdf', { type: 'application/pdf' });
const route = (path, options = {}) => new Request(`${base}${path}`, options);

test('only supported file signatures pass validation', () => {
  assert.equal(detectFileType(new TextEncoder().encode('%PDF-1.7')), 'application/pdf');
  assert.equal(detectFileType(new TextEncoder().encode('<svg><script>')), null);
  assert.equal(detectFileType(new TextEncoder().encode('MZ executable')), null);
});

test('pending files stay private; approval publishes file and status', async () => {
  const { locals } = context();
  const submitted = await upload({ request: formRequest(pdf()), locals });
  assert.equal(submitted.status, 201);
  const { id, receipt } = await submitted.json();
  assert.match(receipt, /^[a-f0-9]{64}$/);
  const publicRequest = route(`/api/submissions/file?id=${id}`);
  assert.equal((await publicFile({ url: new URL(publicRequest.url), locals })).status, 404);
  const statusRequest = route('/api/submissions/status', { method: 'POST', headers: { Origin: base }, body: JSON.stringify({ receipts: [receipt] }) });
  assert.equal((await (await status({ request: statusRequest, locals })).json()).submissions[0].status, 'pending');
  assert.equal((await adminFile({ request: publicRequest, url: new URL(publicRequest.url), locals })).status, 401);
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };
  assert.equal((await adminList({ request: route('/api/submissions/admin', { headers: adminHeaders }), url: new URL(`${base}/api/submissions/admin`), locals })).status, 200);
  assert.equal((await adminFile({ request: route('/api/submissions/admin-file', { headers: adminHeaders }), url: new URL(`${base}/api/submissions/admin-file?id=${id}`), locals })).status, 200);
  const decision = await review({ request: route('/api/submissions/admin', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ id, decision: 'approved' }) }), locals });
  assert.equal(decision.status, 200);
  assert.equal((await review({ request: route('/api/submissions/admin', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ id, decision: 'approved' }) }), locals })).status, 409);
  const file = await publicFile({ url: new URL(publicRequest.url), locals });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get('content-type'), 'application/pdf');
  assert.equal(file.headers.get('content-disposition')?.startsWith('attachment;'), true);
  assert.equal((await (await approved({ url: new URL(`${base}/api/submissions/approved?class=10`), locals })).json()).resources.length, 1);
  assert.equal((await (await approved({ url: new URL(`${base}/api/submissions/approved?class=12`), locals })).json()).resources.length, 0);
  assert.equal((await review({ request: route('/api/submissions/admin', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ id, decision: 'rejected', reason: 'Wrong file' }) }), locals })).status, 200);
  assert.equal((await publicFile({ url: new URL(publicRequest.url), locals })).status, 404);
});

test('rejects cross-origin requests, unsafe files and excessive uploads', async () => {
  const { locals } = context();
  const foreign = formRequest(pdf()); foreign.headers.set('Origin', 'https://evil.test');
  assert.equal((await upload({ request: foreign, locals })).status, 403);
  assert.equal((await upload({ request: formRequest(new File(['<svg onload=alert(1)>'], 'x.svg', { type: 'image/svg+xml' })), locals })).status, 415);
  for (let index = 0; index < 5; index++) assert.equal((await upload({ request: formRequest(pdf()), locals })).status, 201);
  assert.equal((await upload({ request: formRequest(pdf()), locals })).status, 429);
});

test('Discord and Reddit IDs are optional', async () => {
  const { locals } = context();
  const response = await upload({ request: formRequest(pdf(), { discord: undefined, reddit: undefined }), locals });
  assert.equal(response.status, 201);
});
