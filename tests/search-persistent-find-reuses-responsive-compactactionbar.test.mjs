import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('Persistent Find reuses the responsive CompactActionBar', () => {
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findToolWindow, /React\.createElement\(CompactActionBar/);
  assert.match(findToolWindow, /ariaLabel: t\('editor\.findInFilesAction'\)/);
});

test('Find toolbar keeps actions while query-row filters stay at the right', () => {
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  for (const id of ['previous', 'next', 'expand', 'collapse', 'preview', 'include', 'hide']) {
    assert.match(findToolWindow, new RegExp(`id: '${id}'`));
  }
  assert.match(findToolWindow, /id: 'filterSearch'[\s\S]*?pinned: true/);
  assert.match(findToolWindow, /id: 'pin'[\s\S]*?pinned: true/);
  const queryRow = findToolWindow.slice(
    findToolWindow.indexOf("'aria-label': t('editor.findToolSearchPlaceholder')"),
    findToolWindow.indexOf("React.createElement('div', { style: styles.findToolSearchRow"),
  );
  assert.match(queryRow, /icon: 'matchCase'/);
  assert.match(queryRow, /icon: 'wholeWords'/);
  assert.match(queryRow, /icon: 'regex'/);
  assert.match(queryRow, /style: styles\.findToolFilterGroup/);
});

test('Find search and replacement rows wrap their history controls', () => {
  const searchRow = source.slice(source.indexOf('      findToolSearchRow: {'), source.indexOf('      findToolInput: {'));
  const replaceRow = source.slice(source.indexOf('      findToolReplaceRow: {'), source.indexOf('      findToolList: {'));
  assert.match(searchRow, /flexWrap: 'wrap'/);
  assert.match(replaceRow, /flexWrap: 'wrap'/);
});

test('CompactActionBar accepts an inline layout override', () => {
  assert.match(compactActionBarSource, /style = null/);
  assert.match(compactActionBarSource, /\.\.\.\(style \?\? \{\}\)/);
});
