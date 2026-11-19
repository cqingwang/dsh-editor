import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const dialogStart = source.indexOf('function SearchEverywhere(');
const dialogEnd = source.indexOf('function FindToolWindowView(', dialogStart);
const dialog = source.slice(dialogStart, dialogEnd);

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

test('dialog focus cycling wraps in both directions', () => {
  const next = new Function(
    `${extractFunction('searchEverywhereNextFocusIndex')}; return searchEverywhereNextFocusIndex;`,
  )();
  assert.equal(next(3, 0, false), 1);
  assert.equal(next(3, 2, false), 0);
  assert.equal(next(3, 0, true), 2);
  assert.equal(next(3, 1, true), 0);
  assert.equal(next(0, 0, false), null);
  assert.equal(next(3, -1, false), 0);
  assert.equal(next(3, 99, true), 2);
});

test('non-query controls delegate their modal focus loop to the shared helper', () => {
  const trapStart = dialog.indexOf('const trapSearchEverywhereFocus =');
  const trapEnd = dialog.indexOf('const handleSearchEverywhereDialogKeyDown', trapStart);
  assert.ok(trapStart >= 0, 'shared focus-trap wrapper is missing');
  const trap = dialog.slice(trapStart, trapEnd);
  assert.match(trap, /trapDialogFocus\(event, root\)/u);
  assert.doesNotMatch(trap, /querySelectorAll</u);
  assert.doesNotMatch(trap, /searchEverywhereNextFocusIndex\(/u);
});

test('query Tab only cycles the basic search tabs', () => {
  assert.doesNotMatch(dialog, /searchEverywhereProviderCompletion\(state\.query\)/);
  assert.match(dialog, /cycleTab\(event\.shiftKey \? -1 : 1\)/);
  const queryHandler = dialog.slice(
    dialog.indexOf("'data-dsh-search-query': ''"),
    dialog.indexOf("label: t('editor.findSearchHistory')"),
  );
  assert.match(queryHandler, /event\.stopPropagation\(\)/);
});

test('dialog key flow keeps Escape, history, and focus trap ordered', () => {
  const handlerStart = dialog.indexOf('const handleSearchEverywhereDialogKeyDown');
  const handler = dialog.slice(handlerStart, dialog.indexOf('const handledHistoryRequestRef', handlerStart));
  const trapAt = handler.indexOf('trapSearchEverywhereFocus(event)');
  const escapeAt = handler.indexOf("event.key === 'Escape'");
  const historyAt = handler.indexOf('openSearchHistoryShortcut(event)');
  assert.ok(trapAt >= 0, 'focus trap is missing');
  assert.ok(escapeAt > trapAt, 'Escape should follow the Tab trap');
  assert.ok(historyAt > escapeAt, 'history shortcut should remain the fallback');
});
