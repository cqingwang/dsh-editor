import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('keyboard ContextMenu opens the active result menu for every result kind', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(dialog, /openResultMenuAt\(/);
  assert.match(dialog, /data-search-everywhere-active="1"/);
  assert.doesNotMatch(dialog, /activeResult\.kind === 'file' \|\| activeResult\.kind === 'text'/);
  assert.match(dialog, /if \(result\.kind === 'action'\)[\s\S]*?searchShowItemInfo/);
});

test('copy actions report success or browser clipboard failure', () => {
  const copy = source.slice(source.indexOf('function copySearchResultText('), source.indexOf('function searchResultContextItems('));
  assert.match(copy, /navigator\.clipboard\?\.writeText\(text\)/);
  assert.match(copy, /t\('editor\.copiedToClipboard'\)/);
  assert.match(copy, /t\('editor\.clipboardWriteFailed'\)/);
  assert.match(copy, /onNotify\(/);
});

test('Editor wires Search Everywhere notifications to the existing status line', () => {
  const render = source.slice(source.indexOf('React.createElement(SearchEverywhere'), source.indexOf('quickOpen === null'));
  assert.match(render, /onNotify: \(message\) => flashStatus\(message\)/);
});
