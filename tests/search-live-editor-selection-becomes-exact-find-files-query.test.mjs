import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
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
  const findStart = source.indexOf('const openFindInFilesFromShortcut = React.useCallback');
  const findEnd = source.indexOf('/**\n       * Hide the persistent Find tool', findStart);
  const find = source.slice(findStart, findEnd);
  assert.match(find, /const selectedQuery = selectedEditorFindQuery\(currentCodeEditor\(\)\)/u);
  assert.match(find, /query: hasSelectionQuery \? selectedQuery : current\.query/u);
  assert.match(find, /files: hasSelectionQuery \? \[\] : current\.files/u);
  assert.match(find, /searchGeneration: hasSelectionQuery \? \(current\.searchGeneration \?\? 0\) \+ 1/u);
  assert.match(find, /openFindTool\(selectedQuery, 'find'\)/u);

  const replaceStart = source.indexOf('const openBlankReplaceInFilesFromEditor = React.useCallback');
  const replaceEnd = source.indexOf('/** Single shortcut body shared', replaceStart);
  const replace = source.slice(replaceStart, replaceEnd);
  assert.match(replace, /const selectedQuery = selectedEditorFindQuery\(currentCodeEditor\(\)\)/u);
  assert.match(replace, /openFindTool\(selectedQuery, 'replace'\)/u);
  assert.match(replace, /query: selectedQuery/u);
  assert.match(source, /test\(query\) && searchNewLine === false\) setSearchNewLine\(true\)/u);
});

test('double Shift and Cmd/Ctrl+Shift+F share the selection-aware opener', () => {
  assert.match(source, /openFindInFilesFromShortcut\(\);/u);
  assert.match(source, /openBlankReplaceInFilesFromEditor\(\);/u);
  assert.match(source, /doubleShiftAction\(doubleShiftAtRef\.current, event, performance\.now\(\)\)/u);
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
