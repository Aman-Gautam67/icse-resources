import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalogMaterials, flattenCatalog, subjectSlug } from '../src/lib/resource-catalog.mjs';
const folder = (name, children = []) => ({ name, type: 'folder', children });
const file = (name, id) => ({ name, id, type: 'file' });
const read = name => JSON.parse(fs.readFileSync(new URL(`../public/data/${name}.json`, import.meta.url)));
test('discovers subjects from every section and keeps classes separate', () => {
  const data = { classes: { '11': { subjects: folder('subjects', [folder('New Subject', [folder('Chapter 1', [file('Notes.pdf', 'notes')])])]), pyq: folder('pyq', [folder('New Subject', [file('2025.pdf', 'pyq')]), folder('Only PYQ', [file('Paper.pdf', 'only')])]), specimen: folder('specimen', [folder('New Subject', [file('Model.pdf', 'specimen')])]) } } };
  const materials = catalogMaterials(data, '11');
  assert.deepEqual(materials.children.map(node => node.name), ['New Subject', 'Only PYQ']);
  assert.deepEqual(materials.children[0].children.map(node => node.name), ['Chapter 1', 'PYQ', 'Specimen']);
  assert.equal(flattenCatalog(materials).length, 4);
  assert.equal(catalogMaterials(data, '10').children.length, 0);
});
test('migration preserves every legacy Class 10 file ID and filename', () => {
  const original = flattenCatalog(read('study-materials'));
  const catalog = read('resource-catalog');
  const migrated = Object.values(catalog.classes['10']).flatMap(node => flattenCatalog(node));
  const keys = new Set(migrated.map(file => `${file.id}:${file.name}`));
  for (const file of original) assert.ok(keys.has(`${file.id}:${file.name}`), `Missing ${file.name}`);
  for (const node of read('cisce-resources').children.filter(node => ['PYQs', 'Specimen QPs'].includes(node.name))) {
    for (const file of flattenCatalog(node)) assert.ok(keys.has(`${file.id}:${file.name}`), `Missing official paper ${file.name}`);
  }
});
test('prelim year and school folders remain intact', () => {
  const original = read('study-materials').children.find(node => node.name === 'PYQ Prelims');
  const migrated = read('resource-catalog').classes['10'].pyq.children.find(node => node.name === original.name);
  const hierarchy = node => node.type === 'file' ? { name: node.name, type: node.type, id: node.id } : { name: node.name, type: node.type, children: (node.children || []).map(hierarchy) };
  assert.deepEqual(hierarchy(migrated), hierarchy(original));
});
test('existing subject anchors remain stable', () => {
  assert.equal(subjectSlug('History & Civics'), 'history-civics');
  assert.equal(subjectSlug('Computer Applications'), 'computer-applications');
  assert.equal(subjectSlug('Hindi'), 'hindi');
});
