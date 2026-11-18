import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);
const matches = [...actions.matchAll(/id: '([^']+)'/g)];
const blocks = new Map(matches.map((match, index) => [
  match[1],
  actions.slice(match.index, matches[index + 1]?.index ?? actions.length),
]));

test('Search Everywhere exposes IDEA Text action and persistent Find tool entry', () => {
  assert.ok(blocks.has('textSearch'));
  assert.ok(blocks.has('findToolWindow'));
  assert.match(blocks.get('textSearch'), /label: t\('editor\.textSearchAction'\)/);
  assert.match(blocks.get('textSearch'), /keepOpen: true/);
  assert.match(blocks.get('findToolWindow'), /label: t\('editor\.findToolWindowAction'\)/);
  assert.match(blocks.get('findToolWindow'), /openFindTool\('', 'find', null, 'query', 'dock'\)/);
});

test('Text action preserves Search Everywhere and switches only its tab', () => {
  const block = blocks.get('textSearch');
  assert.match(block, /rememberQuery: false/);
  assert.doesNotMatch(block, /searchEverywhereProviderCommand/);
  assert.match(block, /query: current\.query/);
  assert.match(block, /tab: 'text'/);
  assert.doesNotMatch(block, /closeSearchEverywhere/);
});

test('Find Tool Window action closes Search Everywhere before opening the tool window', () => {
  const block = blocks.get('findToolWindow');
  assert.match(block, /closeSearchEverywhere\(\);\n\s+openFindTool\('', 'find', null, 'query', 'dock'\)/);
  assert.match(block, /rememberQuery: false/);
});

test('Text and Find tool actions are localized in both dictionaries', () => {
  assert.match(source, /textSearchAction: '文本…'/);
  assert.match(source, /findToolWindowAction: '查找'/);
  assert.match(source, /findToolWindowSynonym: '查找工具窗口'/);
  assert.match(source, /textSearchAction: 'Text…'/);
  assert.match(source, /findToolWindowAction: 'Find'/);
  assert.match(source, /findToolWindowSynonym: 'Find Tool Window'/);
});
