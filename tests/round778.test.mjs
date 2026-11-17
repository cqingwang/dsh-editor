import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function sourceBlock(startMarker, endMarker) {
  const start = client.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  const end = client.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${endMarker} should follow ${startMarker}`);
  return client.slice(start, end);
}

test('ordinary file opening only activates the editor tab', () => {
  const openFile = sourceBlock(
    'const openFile = React.useCallback(async (path, options = {}) => {',
    '/* IDEA\'s EditSource opens the local working copy',
  );
  assert.doesNotMatch(openFile, /\bsetSelectedPath\(path\)/u);
  assert.match(openFile, /\bsetActivePath\(path\)/u);
});

test('Project tree selection still changes only through explicit tree or reveal actions', () => {
  const revealInProjectTree = sourceBlock(
    'const revealInProjectTree = React.useCallback(async (path) => {',
    'const revealPath = React.useCallback(async (path) => {',
  );
  assert.match(revealInProjectTree, /\bsetSelectedPath\(path\)/u);
  assert.match(client, /onMouseDown: \(event\) => \{[\s\S]*?onSelect\(row, event\)/u);
});
