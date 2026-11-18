import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Search Everywhere exposes its top-level action through the shared opener', () => {
  const start = actions.indexOf("id: 'searchEverywhere'");
  assert.notEqual(start, -1, 'searchEverywhere action is missing');
  const end = actions.indexOf("id: '", start + 1);
  const action = actions.slice(start, end < 0 ? actions.length : end);
  assert.match(action, /label: t\('editor\.searchEverywhereAction'\)/);
  assert.match(action, /description: t\('editor\.searchEverywhereActionHint'\)/);
  assert.match(action, /keepOpen: true/);
  assert.match(action, /rememberQuery: false/);
  assert.match(action, /openSearchEverywhere\('all'\)/);
  assert.match(action, /data-dsh-search-query/);
  assert.doesNotMatch(action, /closeSearchEverywhere/);
});

test('Search Everywhere action uses IDEA identity without overclaiming unsupported indexes', () => {
  assert.match(source, /searchEverywhereAction: '随处搜索'/);
  assert.match(source, /searchEverywhereActionHint: '搜索文件、文本和操作'/);
  assert.match(source, /searchEverywhereAction: 'Search Everywhere'/);
  assert.match(source, /searchEverywhereActionHint: 'Search files, text, and actions'/);
  const ids = [...actions.matchAll(/id: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(ids.length, 33);
  assert.equal(new Set(ids).size, 33);
  assert.ok(ids.includes('searchEverywhere'));
});
