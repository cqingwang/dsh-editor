import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);
const openFindTool = source.slice(
  source.indexOf('const openFindTool = React.useCallback'),
  source.indexOf('const openFindToolInDock = React.useCallback'),
);
const editorFindTool = source.slice(
  source.indexOf('onOpen: (result, openInNewTab = false) => {'),
  source.indexOf('onOpenInRightSplit:', source.indexOf('onOpen: (result, openInNewTab = false) => {')),
);

test('Find handoff preserves the exact content query', () => {
  assert.match(openFindTool, /const textQuery = findToolContentQuery\(query\)/);
  assert.doesNotMatch(openFindTool, /query\.trim\(\)/);
  assert.match(openFindTool, /findToolReopenDraft\(findToolDraftRef\.current, textQuery, mode,/);
  assert.match(openFindTool, /query: draft\.query/);
});

test('Opening a Find result does not write Search Everywhere history', () => {
  assert.doesNotMatch(editorFindTool, /rememberSearchEverywhereQuery\(/);
  assert.doesNotMatch(findTool, /rememberSearchEverywhereQuery\(/);
});

test('Search Everywhere history remains owned by Search Everywhere actions', () => {
  assert.match(source, /const rememberSearchEverywhereQuery = React\.useCallback/);
  assert.match(source, /onRememberQuery: rememberSearchEverywhereQuery/);
  assert.match(source, /dsh-editor\.search\.history:/);
  assert.match(source, /dsh-editor\.find\.query\.history:/);
});
