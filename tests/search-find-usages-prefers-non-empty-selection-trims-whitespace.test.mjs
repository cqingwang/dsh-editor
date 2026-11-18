import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source =
  workspaceSource +
  '\n' +
  commitSource +
  '\n' +
  (await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'));

function extractSource(name) {
  return transpileTypeScriptFunction(commitSource, name);
}

function extract(name) {
  return new Function(`${extractSource(name)}; return ${name};`)();
}

test('Find Usages prefers a non-empty selection and trims whitespace', () => {
  const target = extract('findUsagesSearchTarget');
  const position = { lineNumber: 4, column: 9 };
  const editor = {
    getModel: () => ({
      getValueInRange: () => '  needle  ',
      getWordAtPosition: () => ({ word: 'fallback' }),
    }),
    getSelection: () => ({ isEmpty: () => false, getPosition: () => position }),
    getPosition: () => position,
  };
  assert.deepEqual(target(editor), { query: 'needle', reason: null });
});

test('Find Usages falls back to the symbol at the caret', () => {
  const target = extract('findUsagesSearchTarget');
  const position = { lineNumber: 2, column: 5 };
  const editor = {
    getModel: () => ({
      getValueInRange: () => '',
      getWordAtPosition: (value) => value === position ? { word: 'workspaceValue' } : null,
    }),
    getSelection: () => ({ isEmpty: () => true, getPosition: () => position }),
    getPosition: () => position,
  };
  assert.deepEqual(target(editor), { query: 'workspaceValue', reason: null });
});

test('a multi-line selection falls back instead of trimming into a partial token', () => {
  const target = extract('findUsagesSearchTarget');
  const position = { lineNumber: 3, column: 3 };
  const editor = {
    getModel: () => ({
      getValueInRange: () => '\nEn',
      getWordAtPosition: () => ({ word: 'End' }),
    }),
    getSelection: () => ({ isEmpty: () => false, getPosition: () => position }),
    getPosition: () => position,
  };
  assert.deepEqual(target(editor), { query: 'End', reason: null });
});

test('Find Usages distinguishes no editor from no symbol', () => {
  const target = extract('findUsagesSearchTarget');
  assert.deepEqual(target(null), { query: '', reason: 'editor' });
  const editor = {
    getModel: () => ({ getValueInRange: () => ' \n ', getWordAtPosition: () => null }),
    getSelection: () => ({ isEmpty: () => false, getPosition: () => ({ lineNumber: 1, column: 1 }) }),
    getPosition: () => ({ lineNumber: 1, column: 1 }),
  };
  assert.deepEqual(target(editor), { query: '', reason: 'symbol' });
});

test('Search Everywhere exposes Find Usages as a workspace search action', () => {
  const actionsStart = workspaceSource.indexOf('const searchEverywhereActions =');
  const actionsEnd = workspaceSource.indexOf('/* Recompute match count', actionsStart);
  const actions = workspaceSource.slice(actionsStart, actionsEnd);
  assert.match(actions, /id: 'findUsages'/);
  assert.match(actions, /label: t\('editor\.findUsagesAction'\)/);
  assert.match(actions, /shortcut: ideaUsageFamilyShortcut\('findUsages', searchMacPlatform\)/);
  assert.match(actions, /disabled:\s*findUsagesTarget\.query === ''/);
  assert.match(actions, /openFindTool\(findUsagesTarget\.query, 'find'\)/);
});

test('Option+F7 invokes the same Find Usages handoff outside Search Everywhere', () => {
  assert.match(source, /const usageFamilyAction = ideaUsageFamilyShortcutAction\(/);
  assert.match(source, /usageFamilyAction === 'findUsages'\) openFindUsages\(request\.query\)/);
  assert.match(source, /const request = findUsagesSearchTarget\(currentCodeEditor\(\)\)/);
  assert.match(source, /openFindUsages\(request\.query\)/);
});

test('Find Usages localizes its action and missing-symbol reason', () => {
  assert.match(source, /findUsagesAction: '查找用法…'/);
  assert.match(source, /findUsagesHint: '在整个工作区查找选中文本或当前标识符'/);
  assert.match(source, /findUsagesSymbolRequired: '请选择文本或将光标放在标识符上'/);
  assert.match(source, /findUsagesAction: 'Find Usages…'/);
  assert.match(source, /findUsagesHint: 'Search the workspace for the selection or symbol at caret'/);
  assert.match(source, /findUsagesSymbolRequired: 'Select text or place the caret on a symbol'/);
});
