import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Search Everywhere exposes IDEA Search Web for the selection or caret symbol', () => {
  const action = actions.slice(
    actions.indexOf("id: 'searchWeb'"),
    actions.indexOf("id: 'findNextWordOccurrence'"),
  );
  assert.match(action, /label: t\('editor\.searchWebAction'\)/);
  assert.match(action, /description: t\('editor\.searchWebHint'\)/);
  assert.match(action, /disabled: findUsagesTarget\.query === ''/);
  assert.match(action, /const query = findUsagesTarget\.query/);
  assert.match(action, /closeSearchEverywhere\(\)/);
  assert.match(action, /https:\/\/www\.google\.com\/search\?q=\$\{encodeURIComponent\(query\)\}/);
  assert.match(action, /'_blank',\n\s+'noopener,noreferrer'/);
});

test('Search Web keeps editor and symbol disabled reasons distinct', () => {
  const action = actions.slice(
    actions.indexOf("id: 'searchWeb'"),
    actions.indexOf("id: 'findNextWordOccurrence'"),
  );
  assert.match(action, /findUsagesTarget\.reason === 'editor'/);
  assert.match(action, /editor\.findEditorRequired/);
  assert.match(action, /editor\.findUsagesSymbolRequired/);
});

test('Browser Search is localized while Google remains a searchable alias', () => {
  assert.match(source, /searchWebAction: '浏览器搜索'/);
  assert.match(source, /searchWebHint: '在浏览器中搜索选中文本或光标处标识符'/);
  assert.match(source, /searchWebAction: 'Browser Search'/);
  assert.match(source, /searchWebSynonym: '使用 Google 搜索 · 搜索 Web'/);
  assert.match(source, /searchWebSynonym: 'Search with Google · Search Web'/);
  assert.match(source, /searchWebHint: 'Search the selected text or symbol at the caret in the browser'/);
});
