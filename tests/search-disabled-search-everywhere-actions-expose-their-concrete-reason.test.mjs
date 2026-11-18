import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

function extract(name) {
  return new Function(`${extractSource(name)}; return ${name};`)();
}

test('disabled Search Everywhere actions expose their concrete reason', () => {
  const tooltip = extract('searchEverywhereResultTooltip');
  assert.equal(tooltip({ disabled: true, disabledReason: 'Open a file in the editor first' }), 'Open a file in the editor first');
  assert.equal(tooltip({ disabled: true, disabledReason: 'Open Find and enter a query first' }), 'Open Find and enter a query first');
  assert.equal(
    tooltip({ label: 'Find in Files…', description: 'Text', shortcut: '⇧⌘F' }),
    'Find in Files… — Text — ⇧⌘F',
  );
});

test('keyboard traversal keeps disabled search actions out of the closed focus loop', () => {
  const nextIndex = extract('nextEnabledSearchResultIndex');
  const rows = [
    { id: 'find', disabled: false },
    { id: 'replace', disabled: true },
    { id: 'findInFiles', disabled: false },
    { id: 'replaceInFiles', disabled: true },
  ];
  assert.equal(nextIndex(rows, 0, 1), 2);
  assert.equal(nextIndex(rows, 2, 1), 0);
  assert.equal(nextIndex(rows, 0, -1), 2);
  assert.equal(nextIndex(rows.map((row) => ({ ...row, disabled: true })), 0, 1), null);
});

test('editor-dependent and search-state-dependent actions retain distinct reasons', () => {
  const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
  const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
  const actions = source.slice(actionsStart, actionsEnd);
  const find = actions.slice(actions.indexOf("id: 'find'"), actions.indexOf("id: 'replace'"));
  const findNext = actions.slice(actions.indexOf("id: 'findNext'"), actions.indexOf("id: 'findPrevious'"));
  assert.match(find, /disabled: !hasEditorModel/);
  assert.match(find, /disabledReason: t\('editor\.findEditorRequired'\)/);
  assert.match(findNext, /disabled: !hasEditorModel \|\| replaceState === null \|\| replaceState\.find === ''/);
  assert.match(
    findNext,
    /disabledReason: !hasEditorModel \? t\('editor\.findEditorRequired'\) : t\('editor\.findStepInactive'\)/,
  );
});

test('Search Everywhere result rows connect disabled reasons to both tooltip and assistive text', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /'aria-description': result\.kind === 'action' \? searchEverywhereResultTooltip\(result\) : undefined/);
  assert.match(dialog, /scheduleResultTooltip\(event, result\)/);
  assert.match(dialog, /searchEverywhereResultTooltip\(result\)/);
  assert.match(dialog, /'aria-disabled': result\.disabled === true/);
});
