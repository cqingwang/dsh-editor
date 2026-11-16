import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
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
  assert.match(source, /structuralSearchAction: '结构化搜索…'/);
  assert.match(source, /structuralReplaceAction: '结构化替换…'/);
  assert.match(source, /structuralSearchUnavailable: '当前编辑器未提供语言 AST，结构化搜索和替换暂不可用'/);
  assert.match(source, /structuralSearchAction: 'Search Structurally…'/);
  assert.match(source, /structuralReplaceAction: 'Replace Structurally…'/);
  assert.match(source, /structuralSearchSynonym: 'Structural Search'/);
  assert.match(source, /structuralReplaceSynonym: 'Structural Replace'/);
  assert.match(source, /structuralSearchUnavailable: 'Structural search and replace require a language AST, which the current editor does not provide'/);
});
