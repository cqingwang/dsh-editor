import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const panel = source.slice(
  source.indexOf('<FindToolWindow'),
  source.indexOf('onClose={closeFindToolWindow}', source.indexOf('<FindToolWindow')),
);
const queryTransitionStart = commitSource.indexOf('export function findToolQueryTransition');
const queryTransition = commitSource.slice(
  queryTransitionStart,
  commitSource.indexOf('\nexport function', queryTransitionStart + 1),
);

test('changing the Find query clears a previous replacement error immediately', () => {
  const queryHandler = panel.slice(panel.indexOf('onQuery={(query) =>'), panel.indexOf('onReplace='));
  assert.match(queryHandler, /findToolQueryTransition\(current, query\)/);
  assert.match(queryTransition, /error: null/);
});

test('changing search options also clears stale replacement errors', () => {
  for (const marker of [
    'onToggleCaseSensitive={() =>',
    'onToggleWholeWords={() =>',
    'onToggleRegex={() =>',
    'onFileMaskChange={(fileMask) =>',
  ]) {
    const start = panel.indexOf(marker);
    const next = panel.indexOf('onMove={', start);
    const block = panel.slice(start, next < 0 ? panel.length : next);
    assert.match(block, /findToolSearchOptionsTransition\(/, `${marker} should invalidate result state`);
  }
  assert.match(findToolSource, /error: null/);
});
