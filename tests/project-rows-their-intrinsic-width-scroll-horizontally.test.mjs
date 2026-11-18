import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project rows keep their intrinsic width and scroll horizontally', () => {
  const treeScroll = source.slice(source.indexOf('treeScroll: {'), source.indexOf('treeSearchRow: {'));
  assert.match(treeScroll, /overflowX: 'auto'/);
  assert.match(treeScroll, /overflowY: 'auto'/);
  const treeRow = source.slice(source.indexOf('treeRow: {'), source.indexOf('treeRowSelected: {'));
  assert.match(treeRow, /minWidth: 'max-content'/);
  assert.match(treeRow, /width: 'max-content'/);
});

test('the Project file name is not ellipsized', () => {
  const treeName = source.slice(source.indexOf('treeName: {'), source.indexOf('treeRootName: {'));
  assert.match(treeName, /flex: '0 0 auto'/);
  assert.match(treeName, /minWidth: 'max-content'/);
  assert.match(treeName, /overflow: 'visible'/);
  assert.doesNotMatch(treeName, /textOverflow: 'ellipsis'/);
});
