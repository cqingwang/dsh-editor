import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const logSource = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');
const panelSource = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');

test('Commit Log stays mounted while the Changes tab is active', () => {
  assert.match(panelSource, /<CommitLog\s+hidden=\{mode !== 'log'\}/u);
  assert.match(panelSource, /\{mode === 'log' \? null : \(/u);
  assert.doesNotMatch(panelSource, /mode === 'log' \? \(\s*<CommitLog/u);
});

test('a hidden Commit Log keeps its filter and graph state without layout', () => {
  assert.match(logSource, /hidden\?: boolean;/u);
  assert.match(logSource, /hidden = false,/u);
  assert.match(logSource, /\.\.\.\(hidden \? \{ display: 'none' \} : null\)/u);
  assert.match(logSource, /aria-hidden=\{hidden \? true : undefined\}/u);
  assert.match(logSource, /const \[filter, setFilter\] = React\.useState\(''\);/u);
  assert.match(logSource, /const \[graphMode, setGraphMode\] = React\.useState\(false\);/u);
});
