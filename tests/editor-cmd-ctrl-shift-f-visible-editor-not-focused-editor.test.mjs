import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, zh } from './locale-source.mjs';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

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

function styleBlock(name, nextName) {
  const start = source.indexOf(`${name}: {`);
  const end = source.indexOf(`${nextName}: {`, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

test('Cmd/Ctrl+Shift+F uses the visible Editor, not focused Editor controls', () => {
  const visible = new Function(
    `${extractFunction('visibleEditorWorkspace')}; return visibleEditorWorkspace;`,
  )();
  const element = { isConnected: true, getClientRects: () => [{}] };
  const documentRef = { querySelector: () => element };
  assert.equal(visible(documentRef), element);
  assert.equal(visible({ querySelector: () => ({ ...element, isConnected: false }) }), null);
  assert.equal(visible({ querySelector: () => ({ ...element, getClientRects: () => [] }) }), null);
  assert.equal(visible({ querySelector: () => null }), null);

  assert.equal(typeof visible(documentRef), 'object');
  const shortcut = source.slice(source.indexOf("if (key === 'f' && event.shiftKey)"), source.indexOf("const host = document.querySelector('[data-dsh-editor-workspace]');", source.indexOf("if (key === 'f' && event.shiftKey)")));
  assert.match(shortcut, /visibleEditorWorkspace\(document\) === null/);
  assert.match(shortcut, /openFindInFilesFromShortcut\(\)/);
  assert.doesNotMatch(shortcut, /host\.contains\(document\.activeElement\)/);
});

test('double Shift and Cmd/Ctrl+Shift+F share the Find in Files action', () => {
  assert.match(source, /doubleShiftAction\(/);
  assert.doesNotMatch(source, /searchEverywhereOpenRef/);
  assert.match(source, /const openFindInFilesFromShortcut = React\.useCallback/);
  const shortcutEffects = source.slice(
    source.indexOf('/* Double Shift remains a registered alias'),
    source.indexOf("if (key === 'f' && event.shiftKey)"),
  );
  assert.match(shortcutEffects, /openFindInFilesFromShortcut\(\)/);
  assert.match(source, /onClose: closeSearchEverywhere/);
});

test('searchText unknown-operation retry and friendly fallback are wired', () => {
  const missing = new Function(
    `${extractFunction('fileApiMissingOperation')}; return fileApiMissingOperation;`,
  )();
  assert.equal(missing({ ok: false, error: { message: 'unknown operation "searchText"' } }, 'searchText'), true);
  assert.equal(missing({ ok: false, error: { message: 'unknown operation "read"' } }, 'searchText'), false);
  assert.equal(missing({ ok: true }, 'searchText'), false);

  assert.match(source, /payload\?\.op === 'searchText' && fileApiMissingOperation\(data, 'searchText'\)/);
  assert.match(source, /window\.setTimeout\(resolve, 60\)/);
  assert.equal((source.match(/await requestFileApi\(payload, options\)/g) ?? []).length, 2);

  const failureMessage = new Function(
    `${extractFunction('searchTextFailureMessage')}; return searchTextFailureMessage;`,
  )();
  assert.equal(
    failureMessage(new Error('unknown operation "searchText"'), (key) => key),
    'editor.searchTextServiceUnavailable',
  );
  assert.equal(failureMessage(new Error('permission denied'), (key) => key), 'permission denied');
});

test('host accepts transitional text-search operation spellings', () => {
  assert.match(host, /const rawOperation = typeof body\?\.op === 'string' \? body\.op\.trim\(\) : '';/);
  assert.match(host, /rawOperation === 'textSearch' \|\| rawOperation === 'search-text'/);
  assert.match(host, /const operation = rawOperation === 'textSearch'/);
});

test('Search Everywhere tabs and toolbar have room to breathe', () => {
  const tabs = styleBlock('searchEverywhereTabs', 'searchEverywhereTab');
  assert.match(tabs, /flex: '0 0 44px'/);
  assert.match(tabs, /gap: 22/);
  assert.match(tabs, /height: 44/);
  assert.match(tabs, /padding: '0 16px'/);
  const tabListStart = source.indexOf("role: 'tablist'", source.indexOf('function SearchEverywhere('));
  const tabListStyle = source.slice(tabListStart, source.indexOf("tabs.map", tabListStart));
  assert.match(tabListStyle, /gap: 22/);
  assert.match(tabListStyle, /height: '100%'/);
  assert.doesNotMatch(tabListStyle, /gap: 14/);

  const tab = styleBlock('searchEverywhereTab', 'searchEverywhereTabActive');
  assert.match(tab, /fontSize: 13/);
  assert.match(tab, /padding: '0 2px'/);

  const bar = styleBlock('searchEverywhereActionBar', 'searchEverywhereSearchRow');
  assert.match(bar, /height: 34/);
  assert.match(bar, /gap: 6/);
  assert.match(bar, /padding: '0 12px'/);
  assert.match(source, /style: styles\.searchEverywhereActionBar/);

  const query = styleBlock('searchEverywhereSearchRow', 'searchEverywhereInput');
  assert.match(query, /flex: '0 0 auto'/);
  assert.match(query, /gap: 10/);
  assert.match(query, /minHeight: 46/);
  assert.match(query, /padding: '0 16px'/);
  assert.match(source, /searchEverywhereHint: '切换页签选择文件、文本或操作'/);
  assert.match(source, /searchEverywhereHint: 'Use tabs to choose files, text, or actions'/);
  assert.doesNotMatch(source, /Type \/ to see commands/);
});

test('search service recovery copy exists in both dictionaries', () => {
  assert.equal(
    zh.editor.searchTextServiceUnavailable,
    '文件内容搜索服务暂不可用，请重新打开搜索或刷新编辑器后重试',
  );
  assert.equal(
    en.editor.searchTextServiceUnavailable,
    'File-content search is temporarily unavailable. Reopen search or refresh the editor and try again.',
  );
  const matches = source.match(/searchTextServiceUnavailable:/g) ?? [];
  assert.equal(matches.length, 2);
});
