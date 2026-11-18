import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en } from './locale-source.mjs';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const findToolWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = [searchEverywhereSource, workspaceSource, findToolWindowSource, commitSource].join('\n');

function loadRanker() {
  const functions = ['wholeWordIndex', 'fuzzyScore']
    .map((name) => transpileTypeScriptFunction(findToolSource, name))
    .join('\n');
  return new Function(
    'basename',
    `${functions}\n${transpileTypeScriptFunction(commitSource, 'rankSearchActions')}\nreturn rankSearchActions;`,
  )((path) => path.split('/').at(-1));
}

test('/replace action filtering removes fuzzy description noise and keeps real matches', () => {
  const rank = loadRanker();
  const actions = [
    {
      id: 'replace',
      label: 'Replace…',
      description: 'Replace with',
    },
    {
      id: 'replaceInFiles',
      label: 'Replace in Files…',
      description: 'Replace All',
      shortcut: '⇧⌘R',
    },
    {
      id: 'structuralReplace',
      label: 'Replace Structurally…',
      description: 'Replace code by language structure',
    },
    {
      id: 'incrementalSearch',
      label: 'Incremental Search',
      description: 'Open incremental Find in the active editor',
    },
    {
      id: 'previousOccurrence',
      label: 'Previous Occurrence of the Word at Caret',
      description: 'Move to the next or previous occurrence of the selection or word at caret',
    },
    {
      id: 'findNext',
      label: 'Find Next / Move to Next Occurrence',
      description: 'Repeat the last Find/Replace operation or move to the next occurrence of the selected text',
    },
    {
      id: 'findPrevious',
      label: 'Find Previous / Move to Previous Occurrence',
      description: 'Repeat the last Find/Replace operation in the reverse direction, or moving to the previous occurrence of the selected text',
    },
    {
      id: 'findUsages',
      label: 'Find Usages…',
      description: 'Search the workspace for the selection or symbol at caret',
    },
  ];
  assert.deepEqual(
    rank(actions, 'replace', []).map((action) => action.id),
    ['replace', 'replaceInFiles', 'structuralReplace', 'findNext', 'findPrevious'],
  );
});

test('action labels still accept IDEA fuzzy abbreviations while descriptions stay literal', () => {
  const rank = loadRanker();
  const actions = [
    { id: 'replaceInFiles', label: 'Replace in Files…', description: 'Replace All' },
    { id: 'incrementalSearch', label: 'Incremental Search', description: 'Open incremental Find' },
    { id: 'findNext', label: 'Find Next / Move to Next Occurrence', description: 'Repeat the last Find/Replace operation' },
  ];
  assert.deepEqual(rank(actions, 'rif', []).map((action) => action.id), ['replaceInFiles']);
  assert.deepEqual(rank(actions, 'find replace', []).map((action) => action.id), ['findNext']);
});

test('Find Next and Previous expose IDEA descriptions that participate in /replace', () => {
  const actions = source.slice(
    source.indexOf('const searchEverywhereActions ='),
    source.indexOf('/* Recompute match count'),
  );
  assert.match(actions, /id: 'findNext',[\s\S]*?description: t\('editor\.findNextActionHint'\)/);
  assert.match(actions, /id: 'findPrevious',[\s\S]*?description: t\('editor\.findPreviousActionHint'\)/);
  assert.equal(
    en.editor.findNextActionHint,
    'Repeat the last Find/Replace operation or move to the next occurrence of the selected text',
  );
  assert.equal(
    en.editor.findPreviousActionHint,
    'Repeat the last Find/Replace operation in the reverse direction, or moving to the previous occurrence of the selected text',
  );
  assert.match(actions, /id: 'findInFiles',[\s\S]*?description: t\('editor\.findInFilesHint'\)/);
  assert.match(actions, /id: 'replaceInFiles',[\s\S]*?description: t\('editor\.replaceInFilesHint'\)/);
  assert.equal(en.editor.findInFilesHint, 'Find a string in multiple files');
  assert.equal(en.editor.replaceInFilesHint, 'Replace a string in multiple files with another string');
});

test('replace Enter intent accepts IDEA Alt+Shift and legacy Cmd/Ctrl acceleration', () => {
  const intent = new Function(`${transpileTypeScriptFunction(commitSource, 'replaceInputAction')}; return replaceInputAction;`)();
  assert.equal(intent({ key: 'Enter' }, 'single'), 'single');
  assert.equal(intent({ key: 'Enter' }, 'all'), 'all');
  assert.equal(intent({ key: 'Enter', metaKey: true }, 'single'), 'all');
  assert.equal(intent({ key: 'Enter', ctrlKey: true }, 'single'), 'all');
  assert.equal(intent({ key: 'Enter', altKey: true, shiftKey: true }, 'single'), 'all');
  assert.equal(intent({ key: 'Enter', shiftKey: true }, 'all'), null);
  assert.equal(intent({ key: 'Enter', altKey: true }, 'single'), null);
  assert.equal(intent({ key: 'Enter', isComposing: true }, 'single'), null);
  assert.equal(intent({ key: 'n' }, 'single'), null);
});

test('both replacement inputs use the shared intent resolver', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindowView('),
  );
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(searchEverywhere, /replaceInputAction\(event, 'all'\) === 'all'/);
  assert.match(findTool, /replaceInputAction\(event, 'single'\) !== null/);
  assert.match(findTool, /replaceInputAction\(event, 'single'\) === 'all'/);
  assert.doesNotMatch(findTool, /if \(event\.metaKey\) \{/);
});
