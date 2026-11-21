import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { workspaceFileOperations, WorkspaceWatcher } from '../lib/index.js';

const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('the watcher prefers one recursive handle over per-directory handles', () => {
  assert.match(host, /recursiveWatcher/);
  assert.match(host, /this\.watchImpl\(this\.root,\s*\{ recursive: true, persistent: false \}/);
  assert.match(host, /this\.watchers\.set\(this\.root, watcher\)/);
});

test('recursive startup creates one watcher and close tears it down once', () => {
  const calls = [];
  let closes = 0;
  const fakeWatch = (path, options, listener) => {
    calls.push({ path, options, listener });
    return {
      close() {
        closes += 1;
      },
      on() {},
    };
  };
  const events = [];
  const watcher = new WorkspaceWatcher('/workspace', (event) => events.push(event), {
    recursive: true,
    watchImpl: fakeWatch,
  });
  watcher.start();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/workspace');
  assert.equal(calls[0].options.recursive, true);
  assert.equal(watcher.watchers.size, 1);
  assert.equal(events[0]?.type, 'ready');
  watcher.close();
  assert.equal(closes, 1);
  assert.equal(watcher.watchers.size, 0);
});

test('recursive events report precise directories or request a bounded fallback refresh', async () => {
  let listener = null;
  const fakeWatch = (_path, _options, callback) => {
    listener = callback;
    return { close() {}, on() {} };
  };
  const events = [];
  const watcher = new WorkspaceWatcher('/workspace', (event) => events.push(event), {
    recursive: true,
    watchImpl: fakeWatch,
  });
  watcher.start();
  listener('rename', 'src/deep/file.ts');
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.deepEqual(events.find((event) => event.type === 'change')?.dirs, ['src/deep']);
  assert.deepEqual(events.find((event) => event.type === 'change')?.paths, ['src/deep/file.ts']);
  listener('rename', '.git/index');
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.equal(events.filter((event) => event.type === 'change').at(-1)?.dirs, null);
  assert.deepEqual(events.filter((event) => event.type === 'change').at(-1)?.paths, ['.git/index']);
  listener('rename', 'root-file.ts');
  await new Promise((resolve) => setTimeout(resolve, 160));
  assert.equal(events.filter((event) => event.type === 'change').at(-1)?.dirs, null);
  assert.deepEqual(events.filter((event) => event.type === 'change').at(-1)?.paths, ['root-file.ts']);
  watcher.close();
});

test('recursive events include loaded symlink aliases for internal target paths', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-watch-alias-'));
  const real = join(root, 'real', 'sub');
  await mkdir(real, { recursive: true });
  await symlink(real, join(root, 'alias'), 'dir');
  t.after(() => rm(root, { recursive: true, force: true }));
  await workspaceFileOperations.files(root, 100, { includeExcluded: true });

  let listener = null;
  const fakeWatch = (_path, _options, callback) => {
    listener = callback;
    return { close() {}, on() {} };
  };
  const events = [];
  const watcher = new WorkspaceWatcher(root, (event) => events.push(event), {
    recursive: true,
    watchImpl: fakeWatch,
  });
  t.after(() => watcher.close());
  watcher.start();
  listener('rename', 'real/sub/changed.txt');
  await new Promise((resolve) => setTimeout(resolve, 180));

  assert.deepEqual(events.find((event) => event.type === 'change')?.dirs, ['real/sub', 'alias']);
});

test('the fallback watcher count is small enough to close without freezing', () => {
  assert.match(host, /const MAX_WATCHED_DIRECTORIES = \d+;/);
  const limit = Number(host.match(/const MAX_WATCHED_DIRECTORIES = (\d+);/)?.[1]);
  assert.ok(limit > 0 && limit <= 256, `fallback watcher cap should be <= 256, got ${limit}`);
});
