import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const gitChangeModelSource = readFileSync(join(root, 'src/client/components/ui/git-change-model.ts'), 'utf8');

test('unversioned detection is all-or-nothing and rejects empty or mixed sets', () => {
  const allPathsUnversioned = loadTypeScriptFunction(gitChangeModelSource, 'allPathsUnversioned');
  const changes = new Map([
    ['a', { path: 'a', status: '??' }],
    ['b', { path: 'b', status: '??' }],
    ['c', { path: 'c', status: ' M' }],
  ]);
  assert.equal(allPathsUnversioned([{ path: 'a' }, { path: 'b' }], changes), true);
  assert.equal(allPathsUnversioned([{ path: 'a' }, { path: 'c' }], changes), false);
  assert.equal(allPathsUnversioned([], changes), false);
  assert.equal(allPathsUnversioned([{ path: 'missing' }], changes), false);
});

test('unversioned rollback is labelled and confirmed as deletion', () => {
  assert.match(source, /rollbackUnversioned: '删除未纳入版本控制的文件',/);
  assert.match(source, /rollbackUnversioned: 'Delete Unversioned File',/);
  assert.match(source, /rollbackUnversionedCount: '删除 {count} 个未纳入版本控制的文件',/);
  assert.match(source, /rollbackUnversionedConfirm: '删除 {count} 个未纳入版本控制的文件？此操作不可撤销。',/);
  assert.match(source, /const allUnversioned = allPathsUnversioned\(selected, changesByPathRef\.current\);/);
  assert.match(source, /batchLabel\('editor\.rollbackUnversioned', 'editor\.rollbackUnversionedCount'\)/);
  assert.match(source, /rollback\(paths, allUnversioned \? \{ unversioned: true \} : undefined\)/);
});

test('the rollback confirmation selects the unversioned wording only for that mode', () => {
  const start = source.indexOf('const rollback = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('const buildChangeMenu = React.useCallback(', start));
  assert.match(block, /const unversionedOnly = options\?\.unversioned === true;/);
  assert.match(block, /const confirmKey = stagedOnly/);
  assert.match(block, /unversionedOnly \? 'editor\.rollbackUnversionedConfirm' : 'editor\.rollbackConfirm'/);
});
