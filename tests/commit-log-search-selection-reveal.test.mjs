import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const viewModelSource = await readFile(
  new URL('../src/client/components/commit/commit-log-view-model.ts', import.meta.url),
  'utf8',
);
const logSource = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');

test('selection reveal scrolls the selected commit row into the nearest viewport', () => {
  const { revealCommitLogSelection } = loadTypeScriptModule(viewModelSource, ['revealCommitLogSelection']);
  const calls = [];
  const target = {
    scrollIntoView(options) {
      calls.push(options);
    },
  };
  const list = {
    querySelector(selector) {
      assert.equal(selector, '#dsh-editor-commit-log-option-f75c8fd');
      return target;
    },
  };

  revealCommitLogSelection(list, 'f75c8fd');
  assert.deepEqual(calls, [{ block: 'nearest' }]);
});

test('selection reveal is inert without a list or selected hash', () => {
  const { revealCommitLogSelection } = loadTypeScriptModule(viewModelSource, ['revealCommitLogSelection']);
  assert.doesNotThrow(() => revealCommitLogSelection(null, 'f75c8fd'));
  assert.doesNotThrow(() => revealCommitLogSelection({ querySelector: () => null }, null));
});

test('Commit Log reveals the selected row after full-history search ends', () => {
  assert.match(logSource, /revealCommitLogSelection\(listRef\.current, selected\)/u);
  assert.match(logSource, /if \(hidden \|\| graphMode \|\| searchMode\) return undefined;/u);
  assert.match(logSource, /\[graphMode, hidden, searchMode, selected, visible\.length\]/u);
});
