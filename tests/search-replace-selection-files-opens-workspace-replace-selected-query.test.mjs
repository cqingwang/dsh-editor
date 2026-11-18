import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Replace Selection in Files opens workspace replace with the selected query', () => {
  assert.match(actions, /id: 'replaceSelectionInFiles'/);
  assert.match(actions, /label: t\('editor\.replaceSelectionInFilesAction'\)/);
  assert.match(actions, /disabled:\s*findUsagesTarget\.query === ''/);
  assert.match(actions, /openFindTool\(findUsagesTarget\.query, 'replace', null, 'replace'\)/);
  assert.match(actions, /rememberQuery: false/);
});

test('workspace Find can focus the replacement input after mounting', () => {
  let state = null;
  let focused = null;
  const openFindTool = loadTypeScriptCallback(workspaceSource, 'openFindTool', {
    findToolContentQuery: (query) => String(query ?? '').trim(),
    completeFindFiles: (value) =>
      Array.isArray(value) ? value.filter((item) => typeof item?.path === 'string').map((item) => ({ path: item.path })) : [],
    completeFindMatches: (value) =>
      Array.isArray(value)
        ? value.filter(
            (item) =>
              typeof item?.path === 'string' &&
              typeof item.line === 'number' &&
              typeof item.column === 'number',
          )
        : [],
    normalizeSearchOptions: (value) => value ?? {},
    readSearchOptions: () => ({}),
    readFindScope: () => ({ mode: 'project', preset: 'projectFiles', directory: '' }),
    readFindDirectoryRecursive: () => true,
    rootRef: { current: '' },
    setTerminalOpen: () => {},
    setSearchEverywhere: () => {},
    setFindTool: (value) => {
      state = value;
    },
    findToolHandoffSequenceRef: { current: 0 },
    window: { setTimeout: (callback) => callback() },
    document: {
      querySelector: (selector) => ({
        focus: () => {
          focused = selector;
        },
      }),
    },
  });
  openFindTool('needle', 'replace', null, 'replace', 'popup');
  assert.equal(state.mode, 'replace');
  assert.equal(state.surface, 'popup');
  assert.equal(focused, '[data-dsh-find-replace-input]');
});

test('Replace Selection in Files is localized in both dictionaries', () => {
  assert.match(source, /replaceSelectionInFilesAction: '在文件中替换所选内容'/);
  assert.match(source, /replaceSelectionInFilesHint: '用当前选中文本或光标处标识符打开文件内替换'/);
  assert.match(source, /replaceSelectionInFilesAction: 'Replace Selection in Files'/);
  assert.match(source, /replaceSelectionInFilesHint: 'Open Replace in Files with the selection or symbol text'/);
});
