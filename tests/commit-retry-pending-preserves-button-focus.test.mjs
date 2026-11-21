import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const panelSource = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const rules = loadTypeScriptModule(commitSource, ['commitRetryControlState']);

test('pending Retry keeps focus without using native disabled', () => {
  assert.deepEqual(rules.commitRetryControlState(false, false), {
    disabled: false,
    ariaDisabled: false,
    busy: false,
  });
  assert.deepEqual(rules.commitRetryControlState(false, true), {
    disabled: false,
    ariaDisabled: true,
    busy: true,
  });
  assert.deepEqual(rules.commitRetryControlState(true, true), {
    disabled: true,
    ariaDisabled: true,
    busy: true,
  });
});

test('status and push Retry expose pending semantics without native disabling pending', () => {
  assert.match(panelSource, /retryingStatus/u);
  assert.match(panelSource, /commitRetryControlState\(false, retryingStatus\)/u);
  assert.match(
    panelSource,
    /commitRetryControlState\(busy === true \|\| networkBusy === true \|\| gitNotManaged, pushing\)/u,
  );
  assert.match(panelSource, /disabled=\{statusRetryControl\.disabled\}/u);
  assert.match(panelSource, /disabled=\{pushRetryControl\.disabled\}/u);
  assert.match(panelSource, /aria-busy=\{statusRetryControl\.busy \|\| undefined\}/u);
  assert.match(panelSource, /aria-busy=\{pushRetryControl\.busy \|\| undefined\}/u);
  assert.match(panelSource, /statusRetryControl\.busy \? t\('editor\.loading'\)/u);
  assert.match(editorSource, /retryingStatus=\{commitStatusRetrying\}/u);
  assert.match(editorSource, /networkBusy=\{fetchBusy \|\| updateBusy\}/u);
});

test('Push Retry keeps the failure row mounted until the retry succeeds', () => {
  const pushStart = editorSource.indexOf('const pushNow = React.useCallback(');
  const pushEnd = editorSource.indexOf('/**\n   * Fetch every remote', pushStart);
  assert.notEqual(pushStart, -1);
  assert.notEqual(pushEnd, -1);
  const pushBlock = editorSource.slice(pushStart, pushEnd);
  assert.doesNotMatch(pushBlock, /setPushBusy\(true\);\s+setPushError\(null\);/u);
  assert.match(pushBlock, /setCommitError\(null\);\s+setPushError\(null\);/u);
});
