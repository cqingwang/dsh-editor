import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, zh } from './locale-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Search Everywhere exposes disabled IDEA Structural Search and Replace', () => {
  const structuralSearch = actions.slice(
    actions.indexOf("id: 'structuralSearch'"),
    actions.indexOf("id: 'structuralReplace'"),
  );
  const structuralReplace = actions.slice(
    actions.indexOf("id: 'structuralReplace'"),
    actions.indexOf("id: 'incrementalSearch'"),
  );
  assert.match(structuralSearch, /label: t\('editor\.structuralSearchAction'\)/);
  assert.match(structuralSearch, /description: t\('editor\.structuralSearchHint'\)/);
  assert.match(structuralSearch, /disabled: true/);
  assert.match(structuralSearch, /disabledReason: t\('editor\.structuralSearchUnavailable'\)/);
  assert.match(structuralSearch, /run: \(\) => \{\}/);

  assert.match(structuralReplace, /label: t\('editor\.structuralReplaceAction'\)/);
  assert.match(structuralReplace, /description: t\('editor\.structuralReplaceHint'\)/);
  assert.match(structuralReplace, /disabled: true/);
  assert.match(structuralReplace, /disabledReason: t\('editor\.structuralSearchUnavailable'\)/);
  assert.match(structuralReplace, /run: \(\) => \{\}/);
});

test('Structural actions explain the Monaco AST boundary in both languages', () => {
  assert.equal(zh.editor.structuralSearchAction, '结构化搜索…');
  assert.equal(zh.editor.structuralReplaceAction, '结构化替换…');
  assert.equal(
    zh.editor.structuralSearchUnavailable,
    '当前编辑器未提供语言 AST，结构化搜索和替换暂不可用',
  );
  assert.equal(en.editor.structuralSearchAction, 'Search Structurally…');
  assert.equal(en.editor.structuralReplaceAction, 'Replace Structurally…');
  assert.equal(en.editor.structuralSearchSynonym, 'Structural Search');
  assert.equal(en.editor.structuralReplaceSynonym, 'Structural Replace');
  assert.equal(
    en.editor.structuralSearchUnavailable,
    'Structural search and replace require a language AST, which the current editor does not provide',
  );
});
