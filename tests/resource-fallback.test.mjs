import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArchiveUrl, safeArchiveUrl } from '../src/lib/archive-url.mjs';
import { resourceUrl } from '../src/lib/resource-link.mjs';
import { reachable, resolveResource, createResourceHandler } from '../src/lib/resource-fallback.mjs';
import { flattenCatalog } from '../src/lib/resource-catalog.mjs';
const file = { id: 'example-id', name: 'Paper.pdf', type: 'file', archiveUrl: 'https://archive.org/details/example-paper' };
test('only HTTPS Internet Archive resource URLs are accepted', () => {
  assert.equal(normalizeArchiveUrl('  https://archive.org/download/item/paper.pdf '), 'https://archive.org/download/item/paper.pdf');
  for (const value of ['javascript:alert(1)', 'http://archive.org/details/item', 'https://archive.org.evil.test/details/item', 'https://archive.org@evil.test/details/item', 'https://user:secret@archive.org/details/item', 'https://archive.org:123/details/item', 'https://archive.org/', 'https://archive.org/services/search']) {
    assert.throws(() => normalizeArchiveUrl(value));
    assert.equal(safeArchiveUrl(value), undefined);
  }
  assert.equal(normalizeArchiveUrl(''), undefined);
});
test('catalogue flattening preserves mirrors, missing mirrors remain optional', () => {
  assert.equal(flattenCatalog(file)[0].archiveUrl, file.archiveUrl);
  assert.ok(!('archiveUrl' in flattenCatalog({ ...file, archiveUrl: undefined })[0]));
  assert.equal(resourceUrl(file), '/resource?id=example-id&mode=view');
  assert.match(resourceUrl({ ...file, archiveUrl: undefined }), /^https:\/\/drive.google.com/);
});
test('Drive is preferred; Archive is used automatically on primary failure', async () => {
  const calls = [];
  assert.match(await resolveResource(file, 'view', async (_, provider) => { calls.push(provider); return true; }), /drive.google.com/);
  assert.deepEqual(calls, ['drive']);
  assert.equal(await resolveResource(file, 'view', async (_, provider) => provider === 'archive'), file.archiveUrl);
  assert.equal(await resolveResource(file, 'view', async () => false), null);
  assert.match(await resolveResource({ ...file, archiveUrl: undefined }, 'view', () => { throw new Error('Must not probe'); }), /drive.google.com/);
});
test('Server 2 prefers Archive and falls back to Drive when its copy fails', async () => {
  const calls = [];
  assert.equal(await resolveResource(file, 'download', async (_, provider) => { calls.push(provider); return true; }, '2'), file.archiveUrl);
  assert.deepEqual(calls, ['archive']);
  assert.match(await resolveResource(file, 'download', async (_, provider) => provider === 'drive', '2'), /export=download/);
  assert.equal(await resolveResource(file, 'download', async () => false, '2'), null);
  assert.equal(resourceUrl(file, 'download', '2'), '/resource?id=example-id&mode=download&server=2');
});
test('checks reject HTTP errors, soft errors, sign-in redirects and unsafe redirect hosts', async () => {
  assert.equal(await reachable('https://drive.google.com/uc?id=test', 'drive', async () => new Response('No', { status: 403 })), false);
  assert.equal(await reachable('https://drive.google.com/uc?id=test', 'drive', async () => new Response('Too many users have viewed this file', { headers: { 'Content-Type': 'text/html' } })), false);
  assert.equal(await reachable(file.archiveUrl, 'archive', async () => new Response('Item not available', { headers: { 'Content-Type': 'text/html' } })), false);
  let count = 0;
  assert.equal(await reachable(file.archiveUrl, 'archive', async () => { count++; return new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }); }), false);
  assert.equal(count, 1);
  assert.equal(await reachable('https://drive.google.com/uc?id=test', 'drive', async () => new Response(null, { status: 302, headers: { Location: 'https://accounts.google.com/signin' } })), false);
  assert.equal(await reachable(file.archiveUrl, 'archive', async () => { throw new Error('Network unavailable'); }), false);
});
test('checks accept partial downloads and bound text inspection', async () => {
  assert.equal(await reachable(file.archiveUrl, 'archive', async (_, options) => {
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Range, 'bytes=0-65535');
    return new Response('pdf data', { status: 206, headers: { 'Content-Type': 'application/pdf' } });
  }), true);
});
test('resolver redirects only known catalogue entries and offers no dead mirror links', async () => {
  const handler = createResourceHandler([file], async (_, provider) => provider === 'archive');
  const response = await handler(new URL('https://site.test/resource?id=example-id&url=https://evil.test'));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), file.archiveUrl);
  assert.equal((await handler(new URL('https://site.test/resource?id=unknown'))).status, 404);
  const unavailable = await createResourceHandler([file], async () => false)(new URL('https://site.test/resource?id=example-id'));
  assert.equal(unavailable.status, 503);
  const html = await unavailable.text();
  assert.ok(!html.includes(file.archiveUrl));
  assert.match(html, /Neither copy could be reached/);
});
