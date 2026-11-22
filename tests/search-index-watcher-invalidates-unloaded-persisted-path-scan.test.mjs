import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

function waitForEvent(events, type) {
  const existing = events.find((event) => event.type === type);
  if (existing !== undefined) return Promise.resolve(existing);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 3000);
    const poll = setInterval(() => {
      const event = events.find((candidate) => candidate.type === type);
      if (event === undefined) return;
      clearTimeout(timeout);
      clearInterval(poll);
      resolve(event);
    }, 10);
  });
}

test('a watcher event invalidates a persisted path scan before the index is loaded', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-stale-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-stale-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });
  await writeFile(join(root, 'old.ts'), 'OLD_WATCH_NEEDLE\n', 'utf8');
  const buildHost = await import(
    new URL(`../lib/index.js?watch-unloaded-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root);

  const freshHost = await import(
    new URL(`../lib/index.js?watch-unloaded-stale=${Date.now()}`, import.meta.url)
  );
  const events = [];
  const watcher = new freshHost.WorkspaceWatcher(root, (event) => events.push(event));
  t.after(() => watcher.close());
  watcher.start();
  await waitForEvent(events, 'ready');

  await writeFile(join(root, 'new.ts'), 'NEW_WATCH_NEEDLE\n', 'utf8');
  await waitForEvent(events, 'change');
  const invalidatedStatus = await freshHost.workspaceSearchIndexStatus(root);
  assert.equal(invalidatedStatus.pathScanComplete, false);
  assert.equal(invalidatedStatus.directoryScanComplete, false);

  const first = await freshHost.searchWorkspaceText(root, 'NEW_WATCH_NEEDLE', {
    searchIndex: true,
  });
  assert.notEqual(first.indexFastPath, true);
  assert.deepEqual(
    first.matches.map((match) => match.path),
    ['new.ts'],
  );

  const second = await freshHost.searchWorkspaceText(root, 'NEW_WATCH_NEEDLE', {
    searchIndex: true,
  });
  assert.equal(second.indexFastPath, true);
  assert.deepEqual(
    second.matches.map((match) => match.path),
    ['new.ts'],
  );
});

test('the same unloaded-scan invalidation protects filename searches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-stale-files-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-stale-files-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });
  await writeFile(join(root, 'old-name.ts'), 'export {};\n', 'utf8');
  const buildHost = await import(
    new URL(`../lib/index.js?watch-unloaded-files-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root);

  const freshHost = await import(
    new URL(`../lib/index.js?watch-unloaded-files=${Date.now()}`, import.meta.url)
  );
  const events = [];
  const watcher = new freshHost.WorkspaceWatcher(root, (event) => events.push(event));
  t.after(() => watcher.close());
  watcher.start();
  await waitForEvent(events, 'ready');

  await writeFile(join(root, 'brand-new-name.ts'), 'export {};\n', 'utf8');
  await waitForEvent(events, 'change');

  const request = {
    respectGitIgnore: true,
    searchIndex: true,
    sort: 'name',
    foldersFirst: false,
    filesOnly: true,
  };
  const first = await freshHost.workspaceFileOperations.search(root, 'brand-new-name', request);
  assert.notEqual(first.indexFastPath, true);
  assert.deepEqual(
    first.entries.map((entry) => entry.path),
    ['brand-new-name.ts'],
  );

  const second = await freshHost.workspaceFileOperations.search(root, 'brand-new-name', request);
  assert.equal(second.indexFastPath, true);
  assert.deepEqual(
    second.entries.map((entry) => entry.path),
    ['brand-new-name.ts'],
  );
});
