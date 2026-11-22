import assert from 'node:assert/strict';
import fsPromises from 'node:fs/promises';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const require = createRequire(import.meta.url);
const originalReaddir = require('node:fs').promises.readdir;

function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for traversal')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

test('a watcher event during traversal cannot mark the path scan complete', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-race-root-'));
  const dshHome = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-race-home-'));
  const previousDshHome = process.env.DSH_HOME;
  process.env.DSH_HOME = dshHome;
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(dshHome, { recursive: true, force: true }));
  t.after(() => {
    if (previousDshHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previousDshHome;
  });
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'src', 'a.ts'), 'RACE_TRAVERSAL_NEEDLE\n', 'utf8');
  const buildHost = await import(
    new URL(`../lib/index.js?watch-race-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root);

  let releaseRead = () => {};
  let signalReadStarted = () => {};
  const readGate = new Promise((resolve) => {
    releaseRead = resolve;
  });
  const readStarted = new Promise((resolve) => {
    signalReadStarted = resolve;
  });
  let readCount = 0;
  let gated = false;
  fsPromises.readdir = async (...args) => {
    readCount += 1;
    if (readCount === 3 && !gated) {
      gated = true;
      signalReadStarted();
      await readGate;
    }
    return originalReaddir(...args);
  };
  syncBuiltinESMExports();
  t.after(() => {
    fsPromises.readdir = originalReaddir;
    syncBuiltinESMExports();
    releaseRead();
  });

  const freshHost = await import(
    new URL(`../lib/index.js?watch-race=${Date.now()}`, import.meta.url)
  );
  let fireWatcher = null;
  const fakeWatcher = {
    on() {
      return this;
    },
    close() {},
  };
  const watcher = new freshHost.WorkspaceWatcher(
    root,
    () => {},
    {
      watchImpl(_path, options, callback) {
        if (options?.recursive === true) fireWatcher = callback;
        return fakeWatcher;
      },
    },
  );
  t.after(() => watcher.close());
  watcher.start();

  const searchDirectoryRules = {
    excludedDirectories: ['never'],
    includedDirectories: [],
  };
  const firstSearch = freshHost.searchWorkspaceText(root, 'RACE_TRAVERSAL_NEEDLE', {
    searchIndex: true,
    searchDirectoryRules,
  });
  await withTimeout(readStarted, 3000);
  assert.equal(typeof fireWatcher, 'function');
  fireWatcher('change', 'src/during.ts');
  releaseRead();

  const first = await firstSearch;
  assert.notEqual(first.indexFastPath, true);
  assert.deepEqual(
    first.matches.map((match) => match.path),
    ['src/a.ts'],
  );
  const incomplete = await freshHost.workspaceSearchIndexStatus(root);
  assert.equal(incomplete.pathScanComplete, false);
  assert.equal(incomplete.directoryScanComplete, false);

  const second = await freshHost.searchWorkspaceText(root, 'RACE_TRAVERSAL_NEEDLE', {
    searchIndex: true,
    searchDirectoryRules,
  });
  assert.notEqual(second.indexFastPath, true);
  assert.deepEqual(
    second.matches.map((match) => match.path),
    ['src/a.ts'],
  );
  const complete = await freshHost.workspaceSearchIndexStatus(root);
  assert.equal(complete.pathScanComplete, true);
  assert.equal(complete.directoryScanComplete, true);

  const third = await freshHost.searchWorkspaceText(root, 'RACE_TRAVERSAL_NEEDLE', {
    searchIndex: true,
    searchDirectoryRules,
  });
  assert.equal(third.indexFastPath, true);
  assert.deepEqual(
    third.matches.map((match) => match.path),
    ['src/a.ts'],
  );
});
