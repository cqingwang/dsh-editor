import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { extractUseEffectExpressionContaining, loadTypeScriptExpression, loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const viewModel = read('src/client/components/commit/commit-log-view-model.ts');
const placement = loadTypeScriptFunction(viewModel, 'commitLogLoadMorePlacement');

test('Commit Log search is a bounded Host operation, not a loaded-page filter', () => {
  const hook = read('src/client/components/commit/use-commit-log-search.ts');
  assert.match(hook, /op: 'logSearch'/u);
  assert.match(hook, /limit: 200/u);
  assert.match(hook, /setTimeout\(\(\) => \{/u);
  assert.match(hook, /requestRef\.current\?\.abort\(\)/u);
  assert.match(hook, /searchMode: query\.trim\(\) !== ''/u);
});

test('search mode disables pagination and graph mode', () => {
  assert.equal(
    placement({
      graphMode: false,
      loading: false,
      exhausted: false,
      failed: false,
      commitCount: 20,
      visibleCount: 20,
      searchMode: true,
    }),
    'none',
  );
  const log = read('src/client/components/commit/CommitLog.tsx');
  const toolbar = read('src/client/components/commit/CommitLogToolbar.tsx');
  assert.match(log, /const searchMode = search\?\.searchMode === true;/u);
  assert.match(log, /const graphModeBeforeSearchRef = React\.useRef\(false\);/u);
  assert.match(log, /if \(searchMode\) \{\s+if \(graphMode\) \{\s+graphModeBeforeSearchRef\.current = true;\s+setGraphMode\(false\);/u);
  assert.match(log, /searchMode=\{searchMode\}/u);
  assert.match(toolbar, /disabled=\{disabled \|\| searchMode\}/u);
});

test('clearing search restores the graph mode that search temporarily disabled', () => {
  const log = read('src/client/components/commit/CommitLog.tsx');
  const effectSource = extractUseEffectExpressionContaining(log, 'graphModeBeforeSearchRef.current');
  const calls = [];
  const graphModeBeforeSearchRef = { current: false };
  const run = (graphMode, searchMode) =>
    loadTypeScriptExpression(log, effectSource, {
      graph: { branch: 'main', at: 'abc1234' },
      graphMode,
      graphModeBeforeSearchRef,
      onLoadGraph: (branch, at) => calls.push(['load', branch, at]),
      searchMode,
      setGraphMode: (value) => calls.push(['graph', value]),
    })();
  run(true, true);
  assert.deepEqual(calls, [['graph', false]]);
  assert.equal(graphModeBeforeSearchRef.current, true);
  calls.length = 0;
  run(false, false);
  assert.deepEqual(calls, [
    ['graph', true],
    ['load', 'main', 'abc1234'],
  ]);
  assert.equal(graphModeBeforeSearchRef.current, false);
});

test('search results replace the loaded page and keep their own retry path', () => {
  const log = read('src/client/components/commit/CommitLog.tsx');
  const panel = read('src/client/components/commit/CommitPanel.tsx');
  const workspace = read('src/client/editor-workspace.tsx');
  assert.match(log, /const displayedCommits = searchMode \? search\.results : commits;/u);
  assert.match(log, /const displayedFailure = searchMode \? search\.error : logFailure;/u);
  assert.match(log, /const displayedRetry = searchMode \? search\.retry : onRetry;/u);
  assert.match(panel, /search=\{logSearch\}/u);
  assert.match(workspace, /const logSearch = useCommitLogSearch\(root, logAuthor\)/u);
  assert.match(workspace, /logSearch=\{logSearch\}/u);
});

test('search mode reports no matches and bounded truncation truthfully', () => {
  const state = read('src/client/components/commit/CommitLogListState.tsx');
  assert.match(state, /visibleCount === 0 && \(commitCount > 0 \|\| searchMode\)/u);
  assert.match(state, /!searchMode && !graphMode && commitCount === 0/u);
  assert.match(state, /searchMode && searchTruncated && visibleCount > 0/u);
  assert.match(state, /t\('editor\.logSearchTruncated'\)/u);
});
