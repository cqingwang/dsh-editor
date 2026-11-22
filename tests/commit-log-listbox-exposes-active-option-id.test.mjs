import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const viewModel = await readFile(
  new URL('../src/client/components/commit/commit-log-view-model.ts', import.meta.url),
  'utf8',
);
const log = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');
const flatRow = await readFile(
  new URL('../src/client/components/commit/CommitLogFlatRow.tsx', import.meta.url),
  'utf8',
);
const graphRow = await readFile(
  new URL('../src/client/components/commit/CommitGraphRow.tsx', import.meta.url),
  'utf8',
);

test('Commit Log uses one URL-safe option id for flat and graph rows', () => {
  assert.match(viewModel, /export function commitLogOptionId\(/u);
  assert.match(viewModel, /encodeURIComponent\(/u);
  assert.match(flatRow, /id=\{commitLogOptionId\(commit\.hash\)\}/u);
  assert.match(graphRow, /id=\{commitLogOptionId\(entry\.hash\)\}/u);
});

test('the Commit Log listbox only advertises an active option that is visible', () => {
  assert.match(log, /aria-activedescendant=\{commitLogActiveOptionId === null \? undefined :/u);
  assert.match(log, /visible\.some\(\(commit\) => commit\.hash === flatActiveHash\)/u);
  assert.match(
    log,
    /filteredGraphEntries\.some\(\(entry\) => entry\.hash === graphActiveHash\)/u,
  );
});
