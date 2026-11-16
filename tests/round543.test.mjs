import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

/** Extract one top-level function declaration from the browser bundle. */
function extractSource(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const nextFunction = source.indexOf('\n    function ', start + 1);
  const nextComment = source.indexOf('\n    /**', start + 1);
  const ends = [nextFunction, nextComment].filter((value) => value > start);
  return source.slice(start, Math.min(...ends));
}

const rankSearchActions = new Function(`${extractSource('fuzzyScore')}\n${extractSource('rankSearchActions')}\nreturn rankSearchActions;`)();

test('Find in Files exposes IDEA Find in Path synonym', () => {
  const action = source.slice(
    source.indexOf("id: 'findInFiles'"),
    source.indexOf("id: 'replaceInFiles'"),
  );
  assert.match(action, /keywords: t\('editor\.findInPathSynonym'\)/);
  assert.match(source, /findInPathSynonym: '在路径中查找'/);
  assert.match(source, /findInPathSynonym: 'Find in Path'/);
});

test('Replace in Files exposes IDEA Replace in Path synonym', () => {
  const action = source.slice(
    source.indexOf("id: 'replaceInFiles'"),
    source.indexOf('], [', source.indexOf("id: 'replaceInFiles'")),
  );
  assert.match(action, /keywords: t\('editor\.replaceInPathSynonym'\)/);
  assert.match(source, /replaceInPathSynonym: '在路径中替换'/);
  assert.match(source, /replaceInPathSynonym: 'Replace in Path'/);
});

test('action ranking searches synonyms but keeps the visible identity stable', () => {
  const actions = [
    {
      id: 'findInFiles',
      label: 'Find in Files…',
      description: 'Text',
      keywords: 'Find in Path',
    },
    {
      id: 'replaceInFiles',
      label: 'Replace in Files…',
      description: 'Replace all',
      keywords: 'Replace in Path',
    },
  ];
  assert.equal(rankSearchActions(actions, 'Find in Path', [])[0]?.id, 'findInFiles');
  assert.equal(rankSearchActions(actions, 'Replace in Path', [])[0]?.id, 'replaceInFiles');
  assert.equal(rankSearchActions(actions, 'Find in Path', [])[0]?.label, 'Find in Files…');
});

test('the word-at-caret action uses IDEA action text and description', () => {
  const action = source.slice(
    source.indexOf("id: 'findNextWordOccurrence'"),
    source.indexOf("id: 'findPreviousWordOccurrence'"),
  );
  assert.match(action, /label: t\('editor\.nextWordOccurrenceAction'\)/);
  assert.match(action, /description: t\('editor\.findWordAtCaretHint'\)/);
  assert.match(source, /nextWordOccurrenceAction: '查找文本光标处的字'/);
  assert.match(source, /nextWordOccurrenceAction: 'Next Occurrence of the Word at Caret'/);
  assert.match(source, /nextWordOccurrenceSynonym: 'Find Word at Caret'/);
});
