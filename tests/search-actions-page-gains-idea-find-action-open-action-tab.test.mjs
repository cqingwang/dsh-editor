import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('the Actions page gains IDEA Find Action as a keep-open action-tab entry', () => {
  const start = actions.indexOf("id: 'findAction'");
  assert.notEqual(start, -1, 'findAction is missing');
  const end = actions.indexOf("id: '", start + 1);
  const action = actions.slice(start, end < 0 ? actions.length : end);
  assert.match(action, /label: t\('editor\.findActionAction'\)/);
  assert.match(action, /description: t\('editor\.findActionHint'\)/);
  assert.match(action, /keepOpen: true/);
  assert.match(action, /rememberQuery: false/);
  assert.match(action, /query: ''/);
  assert.match(action, /tab: 'actions'/);
  assert.match(action, /data-dsh-search-query/);
});

test('Find tool-window and selected-file actions use ActionsBundle text', () => {
  assert.match(source, /findToolWindowAction: '查找'/);
  assert.match(source, /findToolWindowAction: 'Find'/);
  assert.match(source, /findToolWindowSynonym: '查找工具窗口'/);
  assert.match(source, /findToolWindowSynonym: 'Find Tool Window'/);
  assert.match(source, /findSelectionInFilesAction: '在文件中查找'/);
  assert.match(source, /findSelectionInFilesAction: 'Find in Files'/);
  assert.match(source, /findSelectionInFilesSynonym: '在文件中查找所选内容'/);
  assert.match(source, /findSelectionInFilesSynonym: 'Find Selection in Files'/);
  for (const id of ['findToolWindow', 'findSelectionInFiles']) {
    const start = actions.indexOf(`id: '${id}'`);
    const end = actions.indexOf("id: '", start + 1);
    assert.match(actions.slice(start, end < 0 ? actions.length : end), /keywords: t\('editor\./);
  }
});

test('the audited Search Everywhere action inventory is unique and complete', () => {
  const ids = [...actions.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, 33);
  assert.equal(new Set(ids).size, 33);
  assert.ok(ids.includes('searchEverywhere'));
  assert.ok(ids.includes('findAction'));
  assert.ok(ids.includes('searchInChanges'));
  assert.equal((actions.match(/label: t\('/g) ?? []).length, 33);
  assert.equal((actions.match(/description: t\('/g) ?? []).length, 33);
});
