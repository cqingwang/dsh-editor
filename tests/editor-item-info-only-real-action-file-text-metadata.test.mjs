import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
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

test('item info uses only real Action, file and text metadata', () => {
  const itemInfo = new Function(
    'basename',
    `${extractFunction('searchEverywhereItemInfo')}; return searchEverywhereItemInfo;`,
  )((path) => path.split('/').at(-1));
  const t = (key) => key;
  assert.deepEqual(itemInfo({
    kind: 'action',
    label: 'Find in Files',
    description: 'Search the workspace',
    shortcut: '⇧⌘F',
  }, t), {
    kind: 'editor.searchItemKindAction',
    title: 'Find in Files',
    detail: 'Search the workspace',
    meta: '⇧⌘F',
  });
  assert.deepEqual(itemInfo({ kind: 'file', path: 'src/a.ts' }, t), {
    kind: 'editor.searchItemKindFile',
    title: 'a.ts',
    detail: 'src/a.ts',
    meta: '',
  });
  assert.deepEqual(itemInfo({
    kind: 'text',
    path: 'src/a.ts',
    line: 3,
    column: 7,
    preview: 'const needle = 1;',
  }, t), {
    kind: 'editor.searchItemKindText',
    title: 'a.ts',
    detail: 'src/a.ts:3:7',
    meta: 'const needle = 1;',
  });
});

test('Show Item Info is available for Action, file and text result menus', () => {
  assert.match(dialog, /const openResultInfo = \(result\) =>/);
  assert.match(dialog, /items: searchResultContextItems\(\{/);
  assert.match(dialog, /onShowInfo: \(\) => openResultInfo\(result\)/);
  assert.match(dialog, /if \(result\.kind === 'action'\)[\s\S]*?searchShowItemInfo/);
  assert.doesNotMatch(dialog, /activeResult\.kind === 'file' \|\| activeResult\.kind === 'text'/);
});

test('item info renders as an accessible in-dialog status surface', () => {
  assert.match(dialog, /const \[resultInfo, setResultInfo\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(dialog, /'data-dsh-search-item-info': ''/);
  assert.match(dialog, /role: 'status'/);
  assert.match(dialog, /'aria-live': 'polite'/);
  assert.match(dialog, /resultInfo\.kind/);
  assert.match(dialog, /resultInfo\.detail/);
  assert.match(dialog, /resultInfo\.meta/);
  assert.match(dialog, /t\('editor\.searchItemClose'\)/);
});

test('item info closes on Escape and returns focus to the query', () => {
  assert.match(dialog, /if \(event\.key === 'Escape' && resultInfo !== null\)/);
  assert.match(dialog, /setResultInfo\(null\)/);
  assert.match(dialog, /searchInputRef\.current\?\.focus\?\.\(\)/);
});

test('item info copy exists in both dictionaries', () => {
  assert.match(source, /searchShowItemInfo: '显示“随处搜索”条目信息'/);
  assert.match(source, /searchShowItemInfo: 'Show Search Everywhere Item Info'/);
  assert.match(source, /searchItemKindAction: '操作'/);
  assert.match(source, /searchItemKindAction: 'Action'/);
  assert.match(source, /searchItemKindFile: '文件'/);
  assert.match(source, /searchItemKindFile: 'File'/);
  assert.match(source, /searchItemKindText: '文本匹配'/);
  assert.match(source, /searchItemKindText: 'Text match'/);
  assert.match(source, /searchItemClose: '关闭条目信息'/);
  assert.match(source, /searchItemClose: 'Close item info'/);
});
