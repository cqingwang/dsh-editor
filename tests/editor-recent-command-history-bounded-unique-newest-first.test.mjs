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
const source = [searchEverywhereSource, findToolWindowSource, workspaceSource, findToolSource, commitSource].join(
  '\n',
);
const actions = workspaceSource.slice(
  workspaceSource.indexOf('const searchEverywhereActions ='),
  workspaceSource.indexOf('/* Recompute match count'),
);

function extract(name) {
  return new Function(
    'basename',
    `${transpileTypeScriptFunction(commitSource, name)}; return ${name};`,
  )((path) => path.split('/').at(-1));
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

test('recent command history is bounded, unique and newest first', () => {
  const remember = extract('rememberCommandHistory');
  assert.deepEqual(remember(['replace'], 'find'), ['find', 'replace']);
  assert.deepEqual(remember(['find', 'replace'], 'find'), ['find', 'replace']);
  assert.deepEqual(remember([], ''), []);
  const many = Array.from({ length: 16 }, (_, index) => `cmd-${index}`);
  assert.equal(remember(many, 'latest', 12).length, 12);
  assert.equal(remember(many, 'latest', 12)[0], 'latest');
});

test('command ranking keeps recent commands ahead on an empty query', () => {
  const rank = loadRanker();
  const actions = [
    { id: 'goToFile', label: 'Go to File', description: '' },
    { id: 'find', label: 'Find…', description: 'Find' },
    { id: 'replace', label: 'Replace…', description: 'Replace' },
  ];
  const ranked = rank(actions, '', ['replace', 'find']);
  assert.deepEqual(ranked.map((action) => action.id), ['replace', 'find', 'goToFile']);
  const filtered = rank(actions, 'replace', ['find']);
  assert.deepEqual(filtered.map((action) => action.id), ['replace']);
});

test('disabled Search Everywhere actions cannot run and advertise their state', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(actions, /disabled:\s*!hasEditorModel \|\| replaceState === null \|\| replaceState\.find === ''/);
  assert.match(dialog, /result\.disabled === true/);
  assert.match(dialog, /aria-disabled=\{result\.disabled === true\}/);
  assert.match(dialog, /onRememberCommand\(result\.id\)/);
  assert.match(source, /dsh-editor\.search\.commandHistory/);
});
