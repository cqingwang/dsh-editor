import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

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

test('Search Everywhere action identities use the installed IDEA 2026.2 action text', () => {
  for (const [value, key] of [
    ['Search Structurally…', 'structuralSearchAction'],
    ['Replace Structurally…', 'structuralReplaceAction'],
    ['Search with Google', 'searchWebAction'],
    ['Next Occurrence of the Word at Caret', 'nextWordOccurrenceAction'],
    ['Add Selection for Next Occurrence', 'selectNextOccurrenceAction'],
    ['Unselect Occurrence', 'unselectPreviousOccurrenceAction'],
  ]) {
    assert.ok(source.includes(`${key}: '${value}'`), `${key} must use IDEA text ${value}`);
  }
});

test('every renamed action keeps its previous identity as a searchable keyword', () => {
  for (const [id, key] of [
    ['structuralSearch', 'structuralSearchSynonym'],
    ['structuralReplace', 'structuralReplaceSynonym'],
    ['searchWeb', 'searchWebSynonym'],
    ['findNextWordOccurrence', 'nextWordOccurrenceSynonym'],
    ['selectNextOccurrence', 'selectNextOccurrenceSynonym'],
    ['unselectPreviousOccurrence', 'unselectPreviousOccurrenceSynonym'],
  ]) {
    const start = actions.indexOf(`id: '${id}'`);
    const end = actions.indexOf('id: \'', start + 1);
    const action = actions.slice(start, end < 0 ? actions.length : end);
    assert.match(action, new RegExp(`keywords: t\\('editor\\.${key}'\\)`), `${id} is missing ${key}`);
  }
});

test('IDEA action text and legacy aliases both rank the same executable action', () => {
  const rank = new Function(
    `${extractFunction('fuzzyScore')}; ${extractFunction('rankSearchActions')}; return rankSearchActions;`,
  )();
  const rows = [
    {
      id: 'structuralSearch',
      label: 'Search Structurally…',
      description: 'Search code by language structure',
      keywords: 'Structural Search',
    },
    {
      id: 'selectNextOccurrence',
      label: 'Add Selection for Next Occurrence',
      description: 'Add the next occurrence',
      keywords: 'Select Next Occurrence',
    },
    {
      id: 'findNextWordOccurrence',
      label: 'Next Occurrence of the Word at Caret',
      description: 'Find the next occurrence',
      keywords: 'Find Word at Caret',
    },
    {
      id: 'searchWeb',
      label: 'Search with Google',
      description: 'Search the Web',
      keywords: 'Search Web',
    },
  ];
  assert.equal(rank(rows, 'Search Structurally', [])[0]?.id, 'structuralSearch');
  assert.equal(rank(rows, 'Structural Search', [])[0]?.id, 'structuralSearch');
  assert.equal(rank(rows, 'Add Selection for Next Occurrence', [])[0]?.id, 'selectNextOccurrence');
  assert.equal(rank(rows, 'Select Next Occurrence', [])[0]?.id, 'selectNextOccurrence');
  assert.equal(rank(rows, 'Next Occurrence of the Word at Caret', [])[0]?.id, 'findNextWordOccurrence');
  assert.equal(rank(rows, 'Find Word at Caret', [])[0]?.id, 'findNextWordOccurrence');
  assert.equal(rank(rows, 'Search with Google', [])[0]?.id, 'searchWeb');
  assert.equal(rank(rows, 'Search Web', [])[0]?.id, 'searchWeb');
});

test('English and Chinese dictionaries contain the IDEA names and aliases', () => {
  assert.match(source, /structuralSearchAction: '结构化搜索…'/);
  assert.match(source, /structuralReplaceAction: '结构化替换…'/);
  assert.match(source, /searchWebAction: '使用 Google 搜索'/);
  assert.match(source, /nextWordOccurrenceAction: '查找文本光标处的字'/);
  assert.match(source, /selectNextOccurrenceAction: '将下一个匹配项添加到选择'/);
  assert.match(source, /unselectPreviousOccurrenceAction: '取消选择匹配项'/);
  for (const key of [
    'structuralSearchSynonym',
    'structuralReplaceSynonym',
    'searchWebSynonym',
    'nextWordOccurrenceSynonym',
    'selectNextOccurrenceSynonym',
    'unselectPreviousOccurrenceSynonym',
  ]) {
    assert.match(source, new RegExp(`${key}: '[^']+'`), `${key} is not localized`);
  }
});
