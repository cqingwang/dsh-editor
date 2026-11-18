import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('DiffPreview registers its existing Search In Changes runner', () => {
  const diffStart = source.indexOf('function DiffPreview(');
  const diffEnd = source.indexOf('export { DiffPreview };', diffStart);
  const diff = source.slice(diffStart, diffEnd);
  assert.match(diff, /searchInChangesRef/);
  assert.match(diff, /searchInChangesRef\.current = searchInChanges/);
  assert.match(diff, /searchInChangesRef\.current === searchInChanges/);
  assert.match(diff, /trigger\('dsh-editor', 'actions\.find', null\)/);
});

test('Search Everywhere exposes Search In Changes through the diff runner', () => {
  const start = actions.indexOf("id: 'searchInChanges'");
  assert.notEqual(start, -1, 'searchInChanges action is missing');
  const end = actions.indexOf("id: '", start + 1);
  const action = actions.slice(start, end < 0 ? actions.length : end);
  assert.match(action, /label: t\('editor\.searchInChanges'\)/);
  assert.match(action, /description: t\('editor\.searchInChangesHint'\)/);
  assert.match(action, /disabled:\s+diffOpen === false/u);
  assert.match(action, /diffTarget\?\.repositoryVersion !== null && typeof diffTarget\?\.repositoryVersion === 'object'/);
  assert.match(action, /disabledReason: t\('editor\.searchInChangesUnavailable'\)/);
  assert.match(action, /closeSearchEverywhere\(\)/);
  assert.match(action, /diffSearchInChangesRef\.current\?\.\(\)/);
  assert.match(source, /searchInChangesRef=\{diffSearchInChangesRef\}/);
});

test('Search In Changes uses IDEA ActionsBundle text and the 32nd inventory slot', () => {
  assert.match(source, /searchInChanges: '在更改中搜索'/);
  assert.match(source, /searchInChanges: 'Search In Changes'/);
  assert.match(source, /searchInChangesHint: '在当前更改差异中打开查找'/);
  assert.match(source, /searchInChangesHint: 'Open Find in the active change diff'/);
  assert.match(source, /searchInChangesUnavailable: '请先打开更改差异'/);
  assert.match(source, /searchInChangesUnavailable: 'Open a change diff first'/);
  const ids = [...actions.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, 33);
  assert.equal(new Set(ids).size, 33);
  assert.ok(ids.includes('searchInChanges'));
});
