import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const foundation = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitLog = await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');
const diffPreview = await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8');

test('visibility-gated polling does not schedule callbacks while hidden', async () => {
  const startVisibilityGatedPoll = loadTypeScriptFunction(foundation, 'startVisibilityGatedPoll');
  const listeners = new Map();
  let nextTimer = 1;
  const timers = new Map();
  let calls = 0;
  const documentRef = {
    visibilityState: 'hidden',
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const windowRef = {
    setTimeout(callback) {
      const id = nextTimer++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const stop = startVisibilityGatedPoll(
    async () => {
      calls += 1;
    },
    1000,
    { documentRef, windowRef },
  );

  assert.equal(timers.size, 0);
  documentRef.visibilityState = 'visible';
  listeners.get('visibilitychange')?.();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  assert.equal(timers.size, 1);

  documentRef.visibilityState = 'hidden';
  listeners.get('visibilitychange')?.();
  assert.equal(timers.size, 0);
  stop();
  assert.equal(listeners.has('visibilitychange'), false);
});

test('Editor background polls use visibility-gated scheduling instead of always-on intervals', () => {
  for (const source of [workspace, commitLog, diffPreview]) {
    assert.doesNotMatch(source, /window\.setInterval\(/u);
  }
  assert.match(workspace, /startVisibilityGatedPoll\(async \(\) =>/u);
  assert.match(workspace, /startVisibilityGatedPoll\([\s\S]*?8000/u);
  assert.match(commitLog, /startVisibilityGatedPoll\(checkLocalFiles, 3000\)/u);
  assert.match(diffPreview, /startVisibilityGatedPoll\(checkLocalPath, delay\)/u);
});
