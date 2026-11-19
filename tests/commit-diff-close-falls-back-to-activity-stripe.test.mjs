import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);
const stripeSource = await readFile(
  new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url),
  'utf8',
);
const projectSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('workspace fallback focuses a stable surface instead of leaving BODY active', () => {
  const calls = [];
  const target = {
    focus(options) {
      calls.push(options);
    },
  };
  const selectors = [];
  const host = {
    querySelector(value) {
      selectors.push(value);
      return value === '[data-dsh-activity-id="commit"]' ? target : null;
    },
  };
  const focusWorkspaceFallback = loadTypeScriptFunction(workspaceSource, 'focusWorkspaceFallback');
  assert.equal(focusWorkspaceFallback(host), true);
  assert.match(selectors[0], /data-dsh-changes-list/u);
  assert.match(selectors[0], /data-dsh-project-tree/u);
  assert.equal(selectors[1], '[data-dsh-activity-id="commit"]');
  assert.deepEqual(calls, [{ preventScroll: true }]);
  assert.equal(focusWorkspaceFallback({ querySelector: () => null }), false);
});

test('Diff close uses the fallback after the source row disappears', () => {
  assert.match(
    workspaceSource,
    /if \(row !== null && row\.isConnected\) row\.focus\(\);[\s\S]*?else focusWorkspaceFallback\(document\.querySelector<HTMLElement>\('\[data-dsh-editor-workspace\]'\)\);/u,
  );
  assert.match(stripeSource, /data-dsh-activity-id=\{id\}/u);
  assert.match(projectSource, /data-dsh-project-tree=''/u);
});
