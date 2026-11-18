import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  commitSource +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));
const actionsStart = workspaceSource.indexOf('const searchEverywhereActions =');
const actionsEnd = workspaceSource.indexOf('/* Recompute match count', actionsStart);
const actions = workspaceSource.slice(actionsStart, actionsEnd);

function extractFunction(name) {
  return transpileTypeScriptFunction(
    name === 'nextEnabledSearchResultIndex' ? commitSource : [findToolSource, commitSource].join('\n'),
    name,
  );
}

test('Find Usages Settings is visible but honestly disabled at the text-search boundary', () => {
  const start = actions.indexOf("id: 'findUsagesSettings'");
  assert.notEqual(start, -1);
  const end = actions.indexOf("id: 'findUsagesInFile'", start);
  const action = actions.slice(start, end);
  assert.match(action, /label: t\('editor\.findUsagesSettingsAction'\)/);
  assert.match(action, /description: t\('editor\.findUsagesSettingsHint'\)/);
  assert.match(action, /shortcut: ideaUsageFamilyShortcut\('findUsagesSettings', searchMacPlatform\)/);
  assert.match(action, /keywords: t\('editor\.findUsagesSettingsSynonym'\)/);
  assert.match(action, /disabled:\s*true/);
  assert.match(action, /disabledReason: t\('editor\.findUsagesSettingsUnavailable'\)/);
  assert.match(action, /run: \(\) => \{\}/);
});

test('Find Usages Settings copy explains the missing language-aware scope model', () => {
  assert.match(source, /findUsagesSettingsAction: '查找用法设置…'/);
  assert.match(source, /findUsagesSettingsAction: 'Find Usages Settings…'/);
  assert.match(source, /findUsagesSettingsSynonym: '[^']*ShowSettingsAndFindUsages'/);
  assert.match(source, /findUsagesSettingsUnavailable: '当前文本搜索没有语言级用法作用域或设置对象'/);
  assert.match(source, /findUsagesSettingsUnavailable: 'The current text-based search has no language-aware usage scopes or settings'/);
});

test('Settings action remains searchable by IDEA action id and ranks ahead of plain Find Usages', () => {
  const rank = new Function(
    'basename',
    `${transpileTypeScriptFunction(findToolSource, 'wholeWordIndex')};
     ${transpileTypeScriptFunction(findToolSource, 'fuzzyScore')};
     ${transpileTypeScriptFunction(commitSource, 'rankSearchActions')};
     return rankSearchActions;`,
  )((path) => path.split('/').at(-1));
  const rows = [
    {
      id: 'findUsages',
      label: 'Find Usages…',
      description: 'Search the workspace for the selection',
      keywords: '',
    },
    {
      id: 'findUsagesSettings',
      label: 'Find Usages Settings…',
      description: 'Choose scope and options for Find Usages',
      keywords: 'ShowSettingsAndFindUsages',
    },
  ];
  assert.equal(rank(rows, 'Find Usages Settings', [])[0]?.id, 'findUsagesSettings');
  assert.equal(rank(rows, 'ShowSettingsAndFindUsages', [])[0]?.id, 'findUsagesSettings');
});

test('disabled settings action is skipped by Search Everywhere keyboard traversal', () => {
  const skip = new Function(
    `${transpileTypeScriptFunction(commitSource, 'nextEnabledSearchResultIndex')}; return nextEnabledSearchResultIndex;`,
  )();
  const rows = [
    { id: 'findUsages', disabled: false },
    { id: 'findUsagesSettings', disabled: true },
    { id: 'findUsagesInFile', disabled: false },
  ];
  assert.equal(skip(rows, 0, 1), 2);
  assert.equal(skip(rows, 2, -1), 0);
});
