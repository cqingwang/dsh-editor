import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const findToolWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const localesSource = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const source = [searchEverywhereSource, findToolWindowSource, workspaceSource, findToolSource, commitSource, localesSource].join('\n');
const actionsStart = workspaceSource.indexOf('const searchEverywhereActions =');
const actionsEnd = workspaceSource.indexOf('/* Recompute match count', actionsStart);
const actions = workspaceSource.slice(actionsStart, actionsEnd);
const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));

function extractSource(name) {
  return transpileTypeScriptFunction(commitSource, name);
}

function loadRanker() {
  const functions = ['wholeWordIndex', 'fuzzyScore']
    .map((name) => transpileTypeScriptFunction(findToolSource, name))
    .join('\n');
  return new Function(
    'basename',
    `${functions}\n${transpileTypeScriptFunction(commitSource, 'rankSearchActions')}\nreturn rankSearchActions;`,
  )((path) => path.split('/').at(-1));
}

test('Find Usages history is stored per workspace and bounded', () => {
  const remember = new Function(
    `${extractSource('rememberSearchHistory')}
     ${extractSource('findUsagesHistoryStorageKey')}
     ${extractSource('readFindUsagesHistory')}
     ${extractSource('writeFindUsagesHistory')}
     ${extractSource('rememberWorkspaceFindUsagesQuery')}
     return rememberWorkspaceFindUsagesQuery;`,
  )();
  const writes = [];
  const storage = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        writes.push([key, value]);
        storage.set(key, value);
      },
    },
  };
  try {
    const first = remember('/workspace', 'End');
    const second = remember('/workspace', 'Scoped');
    assert.deepEqual(second, ['Scoped', 'End']);
    assert.ok(writes[0][0].startsWith('dsh-editor.findUsages.history:'));
    assert.notEqual(writes[0][0], 'dsh-editor.search.history:/workspace');
  } finally {
    globalThis.window = previousWindow;
  }
});

test('Find Usages and Recent Find Usages Actions use the dedicated history path', () => {
  assert.match(actions, /id: 'recentFindUsages'/);
  assert.match(actions, /label: t\('editor\.recentFindUsagesAction'\)/);
  assert.match(actions, /keepOpen: true/);
  assert.match(actions, /rememberQuery: false/);
  assert.match(actions, /setFindUsagesHistoryRequest\(\(current\) => current \+ 1\)/);
  const findUsages = actions.slice(actions.indexOf("id: 'findUsages'"), actions.indexOf("id: 'findUsagesInFile'"));
  assert.match(findUsages, /openFindUsages\(findUsagesTarget\.query\)/);
  assert.doesNotMatch(findUsages, /openFindTool\(/);
});

test('Search Everywhere renders the dedicated recent-usages menu', () => {
  assert.match(dialog, /recentFindUsages/);
  assert.match(dialog, /findUsagesHistoryRequest/);
  assert.match(dialog, /const openFindUsagesHistoryMenuAt = React\.useCallback/u);
  assert.match(dialog, /Array\.isArray\(recentFindUsages\) \? recentFindUsages : \[\]/u);
  assert.match(dialog, /onOpenFindUsagesHistory\(value\)/u);
  assert.match(dialog, /setFindUsagesHistoryMenu\(null\)/u);
});

test('all Find Usages entry points share the recording runner', () => {
  const runner = source.slice(source.indexOf('const openFindUsages = React.useCallback'), source.indexOf('React.useEffect(() => {\n        findUsagesRunnerRef.current'));
  assert.match(runner, /rememberWorkspaceFindUsagesQuery/u);
  assert.match(runner, /openFindTool\(textQuery, 'find'\)/u);
  assert.match(source, /findUsagesRunnerRef\.current = \(editor\) => \{[\s\S]*?openFindUsages\(target\.query\)/u);
  assert.match(source, /openFindUsages\(request\.query\)/u);
});

test('Recent Find Usages text is localized in both dictionaries', () => {
  assert.match(source, /recentFindUsagesAction: '最近的查找用法'/);
  assert.match(source, /recentFindUsagesHint: '选择并重新执行最近的 Find Usages 查询'/);
  assert.match(source, /recentFindUsagesEmpty: '暂无查找用法历史'/);
  assert.match(source, /recentFindUsagesAction: 'Recent Find Usages'/);
  assert.match(source, /recentFindUsagesHint: 'Choose and re-run a recent Find Usages query'/);
  assert.match(source, /recentFindUsagesEmpty: 'No recent Find Usages yet'/);
});

test('Find Usages ranks above Recent Find Usages for the same query', () => {
  const rank = loadRanker();
  const candidates = [
    { id: 'recentFindUsages', label: 'Recent Find Usages', description: '' },
    { id: 'findUsages', label: 'Find Usages…', description: '' },
  ];
  assert.deepEqual(rank(candidates, 'Find Usages', []).map((action) => action.id), [
    'findUsages',
    'recentFindUsages',
  ]);
});
