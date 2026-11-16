import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('empty Search Everywhere separates recent searches from actions', () => {
  const section = extract('searchEverywhereSection');
  const history = { history: true };
  const action = { history: false };
  assert.equal(section(history, null, '', 'all', false), 'recent');
  assert.equal(section(action, history, '', 'all', false), 'actions');
  assert.equal(section(action, action, '', 'all', false), null);
  assert.equal(section(action, null, '', 'all', false), 'actions');
  assert.equal(section(action, null, 'find', 'all', false), null);
  assert.equal(section(action, null, 'find', 'actions', true), 'actions');
});

test('Search Everywhere renders group labels without making them actionable rows', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /searchEverywhereSection\(/);
  assert.match(dialog, /results\[position - 1\]/);
  assert.match(dialog, /'data-search-everywhere-section'/);
  assert.match(dialog, /t\('editor\.searchSectionRecent'\)/);
  assert.match(dialog, /t\('editor\.searchSectionActions'\)/);
});

test('action tooltips expose description and disabled reason', () => {
  const tooltip = extract('searchEverywhereResultTooltip');
  assert.equal(tooltip({ label: 'Replace…', description: 'Replace', shortcut: '⌘R' }), 'Replace… — Replace — ⌘R');
  assert.equal(tooltip({ label: 'Find Next', disabled: true, disabledReason: 'Open Find first' }), 'Open Find first');
  assert.equal(tooltip({ label: '', description: '' }), '');
});

test('Filter menu keeps ContextMenu keyboard navigation and opener focus', () => {
  const menu = source.slice(source.indexOf('function ContextMenu('), source.indexOf('function MenuItems'));
  assert.match(menu, /querySelector\('button\[data-menu-item-id\]:not\(:disabled\)'\)/);
  assert.match(menu, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(menu, /previous !== null && previous\.isConnected\) previous\.focus\(\)/);
});
