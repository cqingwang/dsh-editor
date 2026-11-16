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

test('Search in Selection Only exposes IDEA Toggle Find in Selection metadata', () => {
  const start = actions.indexOf("id: 'searchInSelectionOnly'");
  const end = actions.indexOf("id: 'replaceInSelectionOnly'", start);
  const action = actions.slice(start, end);
  assert.match(action, /shortcut: '⌃⌥E'/);
  assert.match(action, /keywords: t\('editor\.toggleFindInSelectionSynonym'\)/);
});

test('Toggle Find in Selection synonym ranks the existing scoped action first', () => {
  const rank = new Function(
    `${extractFunction('fuzzyScore')}; ${extractFunction('rankSearchActions')}; return rankSearchActions;`,
  )();
  const ranked = rank([
    {
      id: 'searchInSelectionOnly',
      label: 'Search in Selection Only',
      description: 'Search in Selection Only',
      keywords: 'Toggle Find in Selection',
    },
    {
      id: 'replaceInSelectionOnly',
      label: 'Replace in Selection Only',
      description: 'Replace in Selection Only',
      keywords: 'Replace in Selection',
    },
  ], 'Toggle Find in Selection', []);
  assert.equal(ranked[0]?.id, 'searchInSelectionOnly');
});

test('Toggle Find in Selection synonym is localized', () => {
  assert.match(source, /toggleFindInSelectionSynonym: '切换仅在选区内查找'/);
  assert.match(source, /toggleFindInSelectionSynonym: 'Toggle Find in Selection'/);
});

test('the visible shortcut normalizes to Control+Alt+E metadata', () => {
  const normalize = new Function(`${extractFunction('searchEverywhereAriaKeyShortcuts')}; return searchEverywhereAriaKeyShortcuts;`)();
  assert.equal(normalize('⌃⌥E'), 'Control+Alt+E');
});
