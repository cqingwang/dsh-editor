import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { WorkspaceWatcher } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Wait until `check` is true, or fail after `timeout`.
 * @param {() => boolean} check - condition polled on each tick.
 * @param {number} timeout - milliseconds to wait.
 * @returns {Promise<void>} resolves once the condition holds.
 */
async function until(check, timeout = 4000) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('timed out waiting for a filesystem event');
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

/**
 * Wait until the watcher has stopped delivering frames.
 *
 * Filesystem events are asynchronous and coalesced, so a test that asserts on
 * "the next frame" has to know the current burst is over. Quiet for 250ms is
 * well below the host's 120ms coalescing window but far above its delivery gap.
 * @param {object[]} events - the sink being watched.
 * @returns {Promise<void>} resolves once no frame arrived for 250ms.
 */
async function settleFrames(events) {
  for (let quiet = 0; quiet < 25; quiet += 1) {
    const seen = events.length;
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (events.length === seen) return;
  }
}

/** A temporary workspace with a settled watcher on it. */
async function workspace(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r152-'));
  const events = [];
  /* These cases exercise the bounded per-directory fallback. Production prefers
     one recursive FSEvents handle (round383) and only falls back on platforms
     or runtimes that reject recursive watching. */
  const watcher = new WorkspaceWatcher(dir, (event) => events.push(event), { recursive: false });
  /* Close first, then delete: `rm -rf` on a still-watched tree emits events that
     can land in the NEXT test's stream through the shared FSEvents channel. */
  t.after(async () => {
    watcher.close();
    await rm(dir, { recursive: true, force: true });
  });
  watcher.start();
  /* `ready` is emitted after the root watcher exists and the walk starts; waiting
     for it (rather than for a watcher count) keeps the setup deterministic. */
  await until(() => events.some((event) => event.type === 'ready'));
  await until(() => watcher.watchers.size > 0);
  return { dir, events, watcher };
}

/**
 * Watch every directory under one root, deterministically.
 *
 * The host adds watchers from a recursive scan triggered by its own events, so a
 * directory created moments ago is covered a fraction of a second later. Tests
 * must not race that background pass: driving `syncWatches` directly makes the
 * setup complete by the time it returns.
 * @param {WorkspaceWatcher} watcher - watcher to settle.
 * @returns {Promise<string[]>} workspace-relative watched directories.
 */
async function settle(watcher) {
  /* ONE pass is enough now: the walk creates each watcher before descending, and
     `syncWatches` awaits the whole subtree. */
  await watcher.syncWatches(['']);
  return [...watcher.watchers.keys()].map((path) => path.replace(watcher.root, '') || '/');
}

/* ── The watcher must cover everything the tree can show ────────────────── */

test('directories the tree shows are also watched', async (t) => {
  /* Note: each test owns a fresh mkdtemp root under a distinct suffix, so the
     cleanup of one cannot deliver events into the next one's tree. */
  /* The regression: the watcher reused `WALK_IGNORED` (a bound for whole-
     workspace scans) and skipped `node_modules` / `dist`. The tree still shows
     and expands them, so a `pnpm install` could add or remove packages and the
     expanded row never changed — the reported "tree does not follow the disk". */
  const { dir, events, watcher } = await workspace(t);
  const heavyDirs = ['node_modules', 'dist', 'build', '.cache', '__pycache__', '.venv', 'src'];
  for (const heavy of heavyDirs) {
    await mkdir(join(dir, heavy), { recursive: true });
  }
  const watched = await settle(watcher);
  for (const heavy of heavyDirs) {
    assert.ok(watched.includes(`/${heavy}`), `${heavy} is shown by the tree but not watched: ${JSON.stringify(watched)}`);
  }

  /* Creating seven directories queues coalesced frames; let them drain before
     marking, or one of them satisfies the assertion below for the wrong reason.
     A quiet period is used rather than "one frame", because the host may split
     the burst into several. */
  await settleFrames(events);
  events.length = 0;
  await mkdir(join(dir, 'node_modules', 'fresh-package'), { recursive: true });
  await until(() => events.some((event) => event.type === 'change' && event.dirs.includes('node_modules')), 8000);
  assert.ok(events.some((event) => event.type === 'change' && event.dirs.includes('node_modules')));
});

test('the watcher skips only git metadata and caps the watcher count', () => {
  assert.match(host, /const WATCH_IGNORED = IGNORED_DIRECTORIES;/);
  assert.match(host, /const IGNORED_DIRECTORIES = new Set\(\['\.git'\]\);/);
  /* A monorepo with 20k directories must not create 20k watchers. */
  assert.match(host, /const MAX_WATCHED_DIRECTORIES = 256;/);
  assert.match(host, /if \(this\.watchers\.size >= MAX_WATCHED_DIRECTORIES\) return;/);
  /* The walk bound for quick-open / Move-to is a separate list and still skips them. */
  assert.match(host, /const WALK_IGNORED = new Set\(\[/);
});

test('removing an ignored directory still reaches the tree', async (t) => {
  const { dir, events, watcher } = await workspace(t);
  await mkdir(join(dir, 'node_modules', 'pkg-a'), { recursive: true });
  await mkdir(join(dir, 'node_modules', 'pkg-b'), { recursive: true });
  const watched = await settle(watcher);
  assert.ok(watched.includes('/node_modules/pkg-a'), 'pkg-a must be watched before it is deleted');
  await settleFrames(events);
  events.length = 0;
  await rm(join(dir, 'node_modules', 'pkg-a'), { recursive: true });
  /* FSEvents latency is not part of the contract, and the whole suite runs in
     parallel: allow a generous window rather than asserting a speed. */
  await until(() => events.some((event) => event.type === 'change'), 10000);
  assert.ok(events.some((event) => event.type === 'change'), 'deleting a package produced no watch frame');
});

/* ── Cached children must not outlive the directory ────────────────────── */

test('a cache entry whose directory vanished is dropped', () => {
  /* `children` is keyed by directory path and filled on expand. When a directory
     is deleted, its parent's listing stops mentioning it and its rows stop
     rendering — but the entry kept the old files, so re-creating a directory of
     the same name briefly showed a listing from before it existed. */
  const refresh = source.slice(source.indexOf('const refreshTree = React.useCallback('), source.indexOf('Files that appeared since the last refresh'));
  assert.match(refresh, /const read = new Map\(\[\['', Array\.isArray\(listing\) \? listing : \[\]\], \.\.\.Object\.entries\(next\)\]\);/);
  assert.match(refresh, /const parent = dirname\(path\);/);
  assert.match(refresh, /if \(siblings === undefined\) continue;/);
  assert.match(refresh, /if \(siblings\.some\(\(entry\) => entry\?\.path === path\)\) continue;/);
  assert.match(refresh, /delete next\[path\];/);
});

test('pruning only trusts listings that were actually read this round', () => {
  /* Otherwise a collapsed branch — whose parent was not re-read — would lose its
     cache on every refresh and re-fetch on the next expand. */
  const refresh = source.slice(source.indexOf('const refreshTree = React.useCallback('), source.indexOf('Files that appeared since the last refresh'));
  const pruneAt = refresh.indexOf('const read = new Map(');
  const expandAt = refresh.indexOf('for (const path of narrowed ?? [...expandedRef.current])');
  assert.ok(expandAt !== -1 && expandAt < pruneAt, 'pruning must follow the reads it trusts');
  assert.match(source, /for \(const path of narrowed \?\? \[\.\.\.expandedRef\.current\]\) \{/);
});

test('a watcher frame re-reads the parent of every changed directory', () => {
  /* The watcher names directories on disk; the tree only renders an EXPANDED
     one, so a `mkdir assets/x` frame that names `assets` still has to re-read
     `assets` even when it is the changed path itself. `narrowed` carries the
     host's names straight into the read loop. */
  const changeAt = source.indexOf("if (event.type === 'change') {");
  assert.notEqual(changeAt, -1);
  /* Search FORWARD: `error` appears in unrelated handlers earlier in the file. */
  const effect = source.slice(changeAt, source.indexOf("if (event.type === 'error') {", changeAt));
  assert.match(effect, /const changedDirectories = Array\.isArray\(event\.dirs\) \? event\.dirs : null;/);
  assert.match(effect, /await refreshTree\(changedDirectories === null \? undefined : changedDirectories\);/);
  assert.match(effect, /await loadGit\(\);/);
  assert.match(effect, /await checkExternalChanges\(\);/);
});
