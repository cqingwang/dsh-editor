import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function buildFunctions(names) {
  return new Function(`${names.map(extractSource).join('\n')}\nreturn { ${names.join(', ')} };`)();
}

test('editor Find filters matches to one selection scope', () => {
  const { editorFindResult } = buildFunctions(['editorFindResult']);
  const text = 'End before End inside End after';
  const start = text.indexOf('End inside');
  const scope = { start, end: start + 'End inside'.length };
  const matches = editorFindResult(text, 'End', { scope }).matches;
  assert.deepEqual(matches.map((match) => match.offset), [start]);
});

test('scoped replacement changes only matches contained by the scope', () => {
  const { editorFindResult, editorReplaceAll, editorReplaceAt } = buildFunctions([
    'editorFindResult',
    'editorReplaceAll',
    'editorReplaceAt',
  ]);
  const text = 'End End End';
  const scope = { start: 4, end: 7 };
  const all = editorReplaceAll(text, 'End', 'X', { scope });
  assert.equal(all.error, null);
  assert.equal(all.count, 1);
  assert.equal(all.text, 'End X End');
  assert.equal(all.delta, -2);
  const multiple = editorReplaceAll('End End End End', 'End', 'X', { scope: { start: 4, end: 11 } });
  assert.equal(multiple.count, 2);
  assert.equal(multiple.text, 'End X X End');
  assert.equal(multiple.delta, -4);
  const outside = editorReplaceAt(text, 'End', 'X', 0, { scope });
  assert.match(outside.error, /no longer matches/u);
});

test('selection scope is derived from a non-empty Monaco selection', () => {
  const { editorFindSelectionScope } = buildFunctions(['editorFindSelectionScope']);
  const position = (offset) => ({ offset });
  const model = {
    getOffsetAt: (value) => value.offset,
  };
  const editor = {
    getModel: () => model,
    getSelection: () => ({
      isEmpty: () => false,
      getStartPosition: () => position(4),
      getEndPosition: () => position(12),
    }),
  };
  assert.deepEqual(editorFindSelectionScope(editor), { start: 4, end: 12 });
  assert.equal(editorFindSelectionScope(null), null);
});

test('Search in Selection Only is exposed as an IDEA Action', () => {
  assert.match(actions, /id: 'searchInSelectionOnly'/);
  assert.match(actions, /label: t\('editor\.searchInSelectionOnly'\)/);
  assert.match(actions, /rememberQuery: false/);
  assert.match(actions, /disabled: !hasSelectionScope/);
  assert.match(actions, /editor\.findSelectionRequired/);
  assert.match(actions, /openEditorFindInSelection\(selectionScope\)/);
});

test('the editor Find state and toolbar retain the selection-only scope', () => {
  assert.match(source, /const openEditorFindInSelection = React\.useCallback/u);
  assert.match(source, /const nextScope = \{ start: scope\.start, end: scope\.end \}/u);
  assert.match(source, /icon: 'target',[\s\S]*?label: t\('editor\.searchInSelectionOnly'\)/u);
  assert.match(source, /active: replaceState\.scope !== null/u);
  assert.match(source, /onClick: \(\) => toggleFindSelectionScope\(\)/u);
});

test('selection-only text is localized in both dictionaries', () => {
  assert.match(source, /searchInSelectionOnly: '仅在选区内搜索'/);
  assert.match(source, /findSelectionRequired: '请先在编辑器中选择搜索范围'/);
  assert.match(source, /searchInSelectionOnly: 'Search in Selection Only'/);
  assert.match(source, /findSelectionRequired: 'Select a search range in the editor first'/);
});
