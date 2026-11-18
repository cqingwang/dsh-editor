import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-log-shortcut-model.ts');
const { commitLogShortcutAction } = loadTypeScriptModule(source, ['commitLogShortcutAction']);

test('Commit Log uses IDEA L for its filter and F for Find in Files', () => {
  assert.equal(commitLogShortcutAction('l', true, false, false, false), 'focusFilter');
  assert.equal(commitLogShortcutAction('L', false, true, false, false), 'focusFilter');
  assert.equal(commitLogShortcutAction('f', true, false, false, false), 'findInFiles');
  assert.equal(commitLogShortcutAction('F', false, true, false, false), 'findInFiles');
});

test('Commit Log ignores unrelated and modified shortcuts', () => {
  assert.equal(commitLogShortcutAction('l', false, false, false, false), null);
  assert.equal(commitLogShortcutAction('l', true, false, true, false), null);
  assert.equal(commitLogShortcutAction('l', true, false, false, true), null);
  assert.equal(commitLogShortcutAction('f', true, false, false, true), null);
  assert.equal(commitLogShortcutAction('r', true, false, false, false), null);
});

test('CommitLog and editor workspace wire the corrected shortcuts', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const panel = await read('src/client/components/commit/CommitPanel.tsx');
  const workspace = await read('src/client/editor-workspace.tsx');
  const locales = await read('src/client/locales.ts');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /commitLogShortcutAction\(/u);
  assert.match(log, /action === 'findInFiles'[\s\S]*?onFindInFiles\?\.\(\)/u);
  assert.match(panel, /onFindInFiles=\{onFindInFiles\}/u);
  assert.match(workspace, /onFindInFiles=\{openFindInFilesFromShortcut\}/u);
  assert.match(locales, /logFilterHint: '过滤提交（⌘L）'/u);
  assert.match(locales, /logFilterHint: 'Filter commits \(⌘L\)'/u);
  assert.match(build, /commit-log-shortcut-model\.ts/u);
  assert.match(client, /function commitLogShortcutAction\(/u);
});
