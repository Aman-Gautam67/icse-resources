import test from 'node:test';
import assert from 'node:assert/strict';
import { readVisitor, recordEvent, validPage } from '../src/lib/analytics.mjs';

test('anonymous visitor cookie and page path require strict format', () => {
  assert.equal(readVisitor(`theme=dark; icse_visitor=${'a'.repeat(32)}; other=1`), 'a'.repeat(32));
  assert.equal(readVisitor('icse_visitor=bad'), null);
  assert.equal(validPage('/study-materials/all'), true);
  assert.equal(validPage('//external.site'), false);
  assert.equal(validPage('/privacy?student=1'), false);
});

test('event writer rejects invalid activity and saves valid downloads', async () => {
  const writes = [];
  const db = { prepare: sql => ({ bind: (...values) => ({ run: async () => { writes.push({ sql, values }); } }) }) };
  const visitorId = 'b'.repeat(32);
  assert.equal(await recordEvent(db, { visitorId, type: 'visit', page: '//bad' }), false);
  assert.equal(await recordEvent(db, { visitorId, type: 'download', fileId: 'bad' }), false);
  assert.equal(await recordEvent(db, { visitorId, type: 'download', fileId: 'valid_file-id' }, 1000), true);
  assert.deepEqual(writes[0].values, [visitorId, 'download', '', 'valid_file-id', 1000]);
});
