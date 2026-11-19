import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const source = [
  await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'),
  editorCoreSource,
  await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(editorCoreSource, name);
}

function actionBlock(id, nextId) {
  const start = source.indexOf(`id: \`${id}.`);
  const end = source.indexOf(`id: \`${nextId}.`, start);
  assert.ok(start >= 0 && end > start, `${id} action block missing`);
  return source.slice(start, end);
}

test('the live editor selection becomes the exact Find in Files query', () => {
  const selectedEditorFindQuery = new Function(
    `${extractFunction('selectedEditorFindQuery')}; return selectedEditorFindQuery;`,
  )();
  const model = {
    getValueInRange: () => '  exact\nselected  ',
  };
  assert.equal(selectedEditorFindQuery({
    getModel: () => model,
    getSelection: () => ({ isEmpty: () => false }),
  }), '  exact\nselected  ');
  assert.equal(selectedEditorFindQuery({
    getModel: () => model,
    getSelection: () => ({ isEmpty: () => true }),
  }), '');
  assert.equal(selectedEditorFindQuery(null), '');
});

test('Find and Replace shortcuts replace the open query with the latest selection', () => {
  const findStart = source.indexOf('const openFindInFilesFromShortcut =');
  const findEnd = source.indexOf('const closeFindToolWindow', findStart);
  const find = source.slice(findStart, findEnd);
  assert.match(find, /const selectedQuery = selectedEditorFindQuery\(currentCodeEditor\(\)\)/u);
  assert.match(find, /query: hasSelectionQuery \? selectedQuery : current\.query/u);
  assert.match(find, /files: hasSelectionQuery \? \[\] : current\.files/u);
  assert.match(find, /searchGeneration: hasSelectionQuery \? \(current\.searchGeneration \?\? 0\) \+ 1/u);
  assert.match(find, /openFindTool\(selectedQuery, 'find', null, 'query', 'popup', true\)/u);

  const replaceStart = source.indexOf('const openReplaceInFilesFromEditor = React.useCallback');
  const replaceEnd = source.indexOf('const openFindInFilesFromShortcut', replaceStart);
  const replace = source.slice(replaceStart, replaceEnd);
  assert.match(replace, /const selectedQuery = selectedEditorFindQuery\(currentCodeEditor\(\)\)/u);
  assert.match(replace, /openFindTool\(selectedQuery, 'replace', null, 'query', 'popup', true\)/u);
  assert.match(replace, /const query = selectedQuery !== '' \? selectedQuery : current\.query/u);
  assert.match(replace, /query,/u);
  assert.match(source, /test\(query\) && searchNewLine === false\) setSearchNewLine\(true\)/u);
});

test('double Shift opens Search Everywhere while Cmd/Ctrl+Shift+F uses the selection-aware opener', () => {
  assert.match(source, /openFindInFilesFromShortcut\(\);/u);
  assert.match(source, /openReplaceInFilesFromEditor\(\);/u);
  assert.match(source, /doubleShiftAction\(doubleShiftAtRef\.current, event, performance\.now\(\)\)/u);
  const doubleShiftEffect = source.slice(
    source.indexOf('const next = doubleShiftAction'),
    source.indexOf('}, [openSearchEverywhere]);', source.indexOf('const next = doubleShiftAction')),
  );
  assert.match(doubleShiftEffect, /openSearchEverywhere\('all'\)/u);
  assert.doesNotMatch(doubleShiftEffect, /openFindInFilesFromShortcut\(\)/u);
});

test('the four redundant Monaco search actions leave the body context menu', () => {
  for (const [id, nextId] of [
    ['dsh-editor.findUsages', 'dsh-editor.selectAllOccurrences'],
    ['dsh-editor.findInFiles', 'dsh-editor.replaceInFiles'],
    ['dsh-editor.replaceInFiles', 'dsh-editor.findUsagesInFile'],
    ['dsh-editor.replace', 'dsh-editor.incrementalSearch'],
  ]) {
    const block = actionBlock(id, nextId);
    assert.doesNotMatch(block, /contextMenuGroupId/u);
    assert.doesNotMatch(block, /contextMenuOrder/u);
  }
  assert.equal((source.match(/contextMenuGroupId: 'navigation'/g) ?? []).length, 10);
});

test('Browser Search replaces the Google-only visible label but keeps aliases', () => {
  assert.match(source, /searchWebAction: '浏览器搜索'/u);
  assert.match(source, /searchWebHint: '在浏览器中搜索选中文本或光标处标识符'/u);
  assert.match(source, /searchWebAction: 'Browser Search'/u);
  assert.match(source, /searchWebHint: 'Search the selected text or symbol at the caret in the browser'/u);
  assert.match(source, /searchWebSynonym: '[^']*Search with Google[^']*Search Web[^']*'/u);
});
