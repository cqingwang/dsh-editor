import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, ['commitRetryFocusTarget']);

test('Commit status Retry restores focus only after a successful refresh in the visible Commit window', () => {
  assert.equal(rules.commitRetryFocusTarget(true, 'commit', true), 'commit');
  assert.equal(rules.commitRetryFocusTarget(false, 'commit', true), null);
  assert.equal(rules.commitRetryFocusTarget(true, 'project', true), null);
  assert.equal(rules.commitRetryFocusTarget(true, 'commit', false), null);
  assert.equal(rules.commitRetryFocusTarget('true', 'commit', true), null);
});

test('Commit status Retry waits for the refresh result before returning keyboard focus', () => {
  assert.match(
    editorSource,
    /const retryCommitStatus = React\.useCallback\(async \(\): Promise<void> => \{[\s\S]*?const refreshed = await loadGit\(\);[\s\S]*?const target = commitRetryFocusTarget\([\s\S]*?\);[\s\S]*?if \(target !== null\) focusToolWindowContent\(target\);/u,
  );
  assert.match(editorSource, /onRetryStatus=\{retryCommitStatus\}/u);
});
