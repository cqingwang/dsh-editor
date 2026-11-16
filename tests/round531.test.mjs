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

test('Search Everywhere exposes IDEA word-at-caret occurrence actions', () => {
  assert.match(actions, /id: 'findNextWordOccurrence'/);
  assert.match(actions, /label: t\('editor\.nextWordOccurrenceAction'\)/);
  assert.match(actions, /id: 'findPreviousWordOccurrence'/);
  assert.match(actions, /label: t\('editor\.previousWordOccurrenceAction'\)/);
  const usages = actions.indexOf("id: 'findUsages'");
  const next = actions.indexOf("id: 'findNextWordOccurrence'");
  const previous = actions.indexOf("id: 'findPreviousWordOccurrence'");
  assert.ok(usages > 0 && next > usages && previous > next);
});

test('occurrence actions share the Find Usages target and disabled reasons', () => {
  const next = actions.slice(actions.indexOf("id: 'findNextWordOccurrence'"), actions.indexOf("id: 'findPreviousWordOccurrence'"));
  const previous = actions.slice(actions.indexOf("id: 'findPreviousWordOccurrence'"), actions.indexOf("id: 'findNext'"));
  for (const action of [next, previous]) {
    assert.match(action, /disabled: findUsagesTarget\.query === ''/);
    assert.match(action, /findUsagesTarget\.reason === 'editor'/);
    assert.match(action, /editor\.findEditorRequired/);
    assert.match(action, /editor\.findUsagesSymbolRequired/);
  }
});

test('occurrence actions reuse Monaco selection-match commands and return focus', () => {
  const helper = source.slice(source.indexOf('const runWordOccurrence ='), actionsStart);
  assert.match(helper, /activeSourceEditor\.getAction\?\.\(command\)\?\.run\?\.\(\)/);
  assert.match(helper, /activeSourceEditor\.focus\?\.\(\)/);
  assert.match(helper, /closeSearchEverywhere\(\)/);
  assert.match(actions, /runWordOccurrence\('editor\.action\.nextSelectionMatchFindAction'\)/);
  assert.match(actions, /runWordOccurrence\('editor\.action\.previousSelectionMatchFindAction'\)/);
  assert.match(actions, /activeSourceEditor,/);
});

test('word occurrence action text is present in both dictionaries', () => {
  assert.match(source, /nextWordOccurrenceAction: '查找文本光标处的字'/);
  assert.match(source, /previousWordOccurrenceAction: '光标处单词的上一次出现'/);
  assert.match(source, /wordOccurrenceHint: '在编辑器中移动到选中文本或光标处单词的出现位置'/);
  assert.match(source, /findWordAtCaretHint: '查找选中文本或光标处单词的下一个匹配项'/);
  assert.match(source, /nextWordOccurrenceAction: 'Next Occurrence of the Word at Caret'/);
  assert.match(source, /nextWordOccurrenceSynonym: 'Find Word at Caret'/);
  assert.match(source, /previousWordOccurrenceAction: 'Previous Occurrence of the Word at Caret'/);
  assert.match(source, /wordOccurrenceHint: 'Move to the next or previous occurrence of the selection or word at caret'/);
  assert.match(source, /findWordAtCaretHint: 'Find the next occurrence of the selection or word at caret'/);
});

test('an exact action label outranks another action whose description mentions it', () => {
  const rank = new Function(
    `${extractSource('fuzzyScore')}\n${extractSource('rankSearchActions')}\nreturn rankSearchActions;`,
  )();
  const candidates = [
    {
      id: 'next',
      label: 'Next Occurrence of the Word at Caret',
      description: 'Move to the next or previous occurrence of the selection or word at caret',
    },
    {
      id: 'previous',
      label: 'Previous Occurrence of the Word at Caret',
      description: 'Move to the next or previous occurrence of the selection or word at caret',
    },
  ];
  assert.deepEqual(rank(candidates, 'Previous Occurrence', []).map((action) => action.id), [
    'previous',
    'next',
  ]);
  assert.deepEqual(rank(candidates, 'Next Occurrence', []).map((action) => action.id), [
    'next',
    'previous',
  ]);
});
