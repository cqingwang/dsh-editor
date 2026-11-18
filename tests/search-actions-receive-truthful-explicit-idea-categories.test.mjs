import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('search Actions receive truthful explicit IDEA categories', () => {
  const mapStart = source.indexOf('const SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS');
  const mapTail = source.slice(mapStart).match(/\]\s*\);/u);
  const mapEnd = mapTail === null ? -1 : mapStart + mapTail.index + mapTail[0].length;
  assert.ok(mapStart >= 0 && mapEnd > mapStart);
  const category = new Function(
    `${source.slice(mapStart, mapEnd)};` +
      `${extractFunction('searchEverywhereActionCategory')};` +
      'return searchEverywhereActionCategory;',
  )();
  const t = (key) => key;
  assert.equal(category('searchEverywhere', t), 'editor.searchCategoryNavigate');
  assert.equal(category('goToFile', t), 'editor.searchCategoryNavigate');
  assert.equal(category('showSearchHistory', t), 'editor.searchCategoryNavigate');
  assert.equal(category('find', t), 'editor.searchCategoryEditFind');
  assert.equal(category('replaceInFiles', t), 'editor.searchCategoryEditFind');
  assert.equal(category('findNext', t), 'editor.searchCategoryEditFind');
  assert.equal(category('findUsages', t), 'editor.searchCategoryEditFindUsages');
  assert.equal(category('showUsages', t), 'editor.searchCategoryEditFindUsages');
  assert.equal(category('findToolWindow', t), null);
  assert.equal(category('incrementalSearch', t), null);
  assert.equal(category('unknownAction', t), null);
});

test('Action rows expose category without displacing the shortcut', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /category: searchEverywhereActionCategory\(action\.id, t\)/);
  assert.match(dialog, /data-dsh-search-category=''/);
  assert.match(dialog, /className='dsh-editor-search-everywhere-category'/);
  assert.ok(dialog.indexOf('data-dsh-search-category') < dialog.indexOf('result.shortcut ? <span'));
});

test('category is removed before narrow rows squeeze primary content', () => {
  assert.match(source, /\.dsh-editor-search-everywhere-row \{ container-type: inline-size; \}/);
  assert.match(source, /@container \(max-width: 460px\)/);
  assert.match(source, /\.dsh-editor-search-everywhere-category \{ display: none !important; \}/);
});

test('tooltip and Item Info carry category metadata', () => {
  const tooltip = new Function(
    `${extractFunction('searchEverywhereResultTooltip')}; return searchEverywhereResultTooltip;`,
  )();
  assert.equal(
    tooltip({ label: 'Replace…', description: 'Replace', category: 'Edit | Find', shortcut: '⌘R' }),
    'Replace… — Replace — Edit | Find — ⌘R',
  );
  const itemInfo = new Function(
    'basename',
    `${extractFunction('searchEverywhereItemInfo')}; return searchEverywhereItemInfo;`,
  )((path) => path.split('/').at(-1));
  assert.deepEqual(
    itemInfo(
      {
        kind: 'action',
        label: 'Replace…',
        description: 'Replace',
        category: 'Edit | Find',
        shortcut: '⌘R',
      },
      (key) => key,
    ),
    {
      kind: 'editor.searchItemKindAction',
      title: 'Replace…',
      detail: 'Replace',
      meta: 'Edit | Find · ⌘R',
    },
  );
});

test('category copy exists in both dictionaries', () => {
  assert.match(source, /searchCategoryNavigate: '导航'/);
  assert.match(source, /searchCategoryNavigate: 'Navigate'/);
  assert.match(source, /searchCategoryEditFind: '编辑 \| 查找'/);
  assert.match(source, /searchCategoryEditFind: 'Edit \| Find'/);
  assert.match(source, /searchCategoryEditFindUsages: '编辑 \| 查找用法'/);
  assert.match(source, /searchCategoryEditFindUsages: 'Edit \| Find Usages'/);
});
