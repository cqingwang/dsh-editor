import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, ['commitRetryFocusTarget']);

test('Commit Retry focus policy is shared by status and push success paths', () => {
  assert.equal(rules.commitRetryFocusTarget(true, 'commit', true), 'commit');
  assert.equal(rules.commitRetryFocusTarget(false, 'commit', true), null);
  assert.equal(rules.commitRetryFocusTarget(true, 'project', true), null);
  assert.equal(rules.commitRetryFocusTarget(true, 'commit', false), null);
});

test('Push Retry restores Commit content focus only after the push succeeds', () => {
  const pushStart = editorSource.indexOf('const pushNow = React.useCallback(');
  assert.notEqual(pushStart, -1);
  const pushEnd = editorSource.indexOf('/**\n   * Fetch every remote', pushStart);
  assert.notEqual(pushEnd, -1);
  const pushBlock = editorSource.slice(pushStart, pushEnd);
  assert.match(pushBlock, /setPushError\(null\)/u);
  assert.match(pushBlock, /commitRetryFocusTarget\(\s*true,\s*activityRef\.current,\s*panelVisibleRef\.current\s*\)/u);
  assert.match(pushBlock, /focusToolWindowContent\(target\)/u);
});
