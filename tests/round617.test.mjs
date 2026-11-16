import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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

test('/replace action filtering removes fuzzy description noise and keeps real matches', () => {
  const rank = new Function(
    `${extractFunction('fuzzyScore')}; ${extractFunction('rankSearchActions')}; return rankSearchActions;`,
  )();
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
  const rank = new Function(
    `${extractFunction('fuzzyScore')}; ${extractFunction('rankSearchActions')}; return rankSearchActions;`,
  )();
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
    source.indexOf('const searchEverywhereActions = React.useMemo'),
    source.indexOf('/* Recompute match count'),
  );
  assert.match(actions, /id: 'findNext',[\s\S]*?description: t\('editor\.findNextActionHint'\)/);
  assert.match(actions, /id: 'findPrevious',[\s\S]*?description: t\('editor\.findPreviousActionHint'\)/);
  assert.match(source, /findNextActionHint: 'Repeat the last Find\/Replace operation or move to the next occurrence of the selected text'/);
  assert.match(source, /findPreviousActionHint: 'Repeat the last Find\/Replace operation in the reverse direction, or moving to the previous occurrence of the selected text'/);
  assert.match(actions, /id: 'findInFiles',[\s\S]*?description: t\('editor\.findInFilesHint'\)/);
  assert.match(actions, /id: 'replaceInFiles',[\s\S]*?description: t\('editor\.replaceInFilesHint'\)/);
  assert.match(source, /findInFilesHint: 'Find a string in multiple files'/);
  assert.match(source, /replaceInFilesHint: 'Replace a string in multiple files with another string'/);
});

test('replace Enter intent accepts IDEA Alt+Shift and legacy Cmd/Ctrl acceleration', () => {
  const intent = new Function(
    `${extractFunction('replaceInputAction')}; return replaceInputAction;`,
  )();
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
    source.indexOf('function FindToolWindow('),
  );
  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('function QuickOpen('),
  );
  assert.match(searchEverywhere, /replaceInputAction\(event, 'all'\) === 'all'/);
  assert.match(findTool, /replaceInputAction\(event, 'single'\) !== null/);
  assert.match(findTool, /replaceInputAction\(event, 'single'\) === 'all'/);
  assert.doesNotMatch(findTool, /if \(event\.metaKey\) \{/);
});
