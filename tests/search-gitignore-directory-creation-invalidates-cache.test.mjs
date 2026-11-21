import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { WorkspaceWatcher } from '../lib/index.js';
import { extractVariableInitializerExpression, loadTypeScriptExpression } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

async function until(check, timeout = 2000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('timed out waiting for a watcher event');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('a basename-only directory event marks Git search scope as potentially changed', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-directory-scope-signal-'));
  const events = [];
  let listener = null;
  const fakeWatcher = new EventEmitter();
  fakeWatcher.close = () => {};
  const watcher = new WorkspaceWatcher(root, (event) => events.push(event), {
    watchImpl: (_path, _options, callback) => {
      listener = callback;
      return fakeWatcher;
    },
  });
  t.after(async () => {
    watcher.close();
    await rm(root, { recursive: true, force: true });
  });

  watcher.start();
  await mkdir(join(root, 'new-project'));
  listener('rename', 'new-project');
  await until(() => events.some((event) => event.type === 'change'));
  const change = events.find((event) => event.type === 'change');
  assert.equal(change.searchScopeMayHaveChanged, true);
  assert.deepEqual(change.paths, ['new-project']);
});

test('a basename-only file event does not invalidate Git search scope', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-file-scope-signal-'));
  const events = [];
  let listener = null;
  const fakeWatcher = new EventEmitter();
  fakeWatcher.close = () => {};
  const watcher = new WorkspaceWatcher(root, (event) => events.push(event), {
    watchImpl: (_path, _options, callback) => {
      listener = callback;
      return fakeWatcher;
    },
  });
  t.after(async () => {
    watcher.close();
    await rm(root, { recursive: true, force: true });
  });

  watcher.start();
  await writeFile(join(root, 'root-file.txt'), 'content\n', 'utf8');
  listener('change', 'root-file.txt');
  await until(() => events.some((event) => event.type === 'change'));
  const change = events.find((event) => event.type === 'change');
  assert.equal(change.searchScopeMayHaveChanged, false);
  assert.deepEqual(change.paths, ['root-file.txt']);
});

test('the editor invalidates Git-backed search when the watcher reports the scope signal', async () => {
  const revisions = [];
  const handle = loadTypeScriptExpression(
    workspaceSource,
    extractVariableInitializerExpression(workspaceSource, 'handle'),
    {
      disposed: false,
      chain: Promise.resolve(),
      root: '/workspace',
      refreshTree: async () => [],
      loadGit: async () => {},
      checkExternalChanges: async () => {},
      invalidateFindAfterExternalDelete: async () => {},
      setFindTool: () => {},
      setMarkdownAssetRevisions: () => {},
      nextMarkdownAssetRevisions: (current) => current,
      workspaceChangeInvalidatesSearchScope: () => false,
      setSearchRevision: (updater) => revisions.push(updater(4)),
    },
  );
  handle({
    type: 'change',
    dirs: ['new-project'],
    paths: ['new-project'],
    searchScopeMayHaveChanged: true,
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(revisions, [5]);
});
