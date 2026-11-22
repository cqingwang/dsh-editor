import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  WorkspaceWatcher,
  workspaceFileOperations,
} from '../lib/index.js';

function initRepository(root) {
  execFileSync('git', ['-C', root, 'init', '-q']);
  execFileSync('git', ['-C', root, 'config', 'user.name', 'Test']);
  execFileSync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
}

test('the All-tab text provider can return a bounded Git-index preview immediately', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-fast-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  initRepository(root);
  await writeFile(join(root, 'tracked.ts'), 'const value = FAST_GIT_NEEDLE;\n', 'utf8');
  await writeFile(join(root, 'untracked.ts'), '// FAST_GIT_NEEDLE\n', 'utf8');
  execFileSync('git', ['-C', root, 'add', 'tracked.ts']);

  const result = await searchWorkspaceText(root, 'FAST_GIT_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, true);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((match) => match.path).sort(),
    ['tracked.ts', 'untracked.ts'],
  );
});

test('a non-Git workspace falls back to the complete workspace scan', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-fallback-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'ordinary.ts'), 'FALLBACK_ONLY_NEEDLE\n', 'utf8');

  const result = await searchWorkspaceText(root, 'FALLBACK_ONLY_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, undefined);
  assert.deepEqual(result.matches.map((match) => match.path), ['ordinary.ts']);
});

test('custom Scope patterns keep the complete workspace scan authoritative', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  initRepository(root);
  await writeFile(join(root, 'tracked.ts'), 'SCOPED_GIT_NEEDLE\n', 'utf8');
  execFileSync('git', ['-C', root, 'add', 'tracked.ts']);

  const result = await searchWorkspaceText(root, 'SCOPED_GIT_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    scopeIncludePatterns: ['*.md'],
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, undefined);
  assert.deepEqual(result.matches, []);
});

test('Search Everywhere enables the partial Git preview only on the All tab', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
  assert.match(source, /fastPartialTextSearch: searchEverywhere\?\.tab === 'all',/u);
});

test('positive partial Git previews reuse a bounded watcher-scoped memory cache', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-cache-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-cache-index-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  initRepository(root);
  const file = join(root, 'tracked.ts');
  await writeFile(file, 'const value = FAST_CACHE_NEEDLE;\n', 'utf8');
  execFileSync('git', ['-C', root, 'add', 'tracked.ts']);
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const watcher = new WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const options = {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    searchSessionId: 'partial-cache-1',
    searchRevision: 1,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  };
  const first = await searchWorkspaceText(root, 'FAST_CACHE_NEEDLE', options);
  assert.equal(first.fastPartialTextSearch, true);
  assert.notEqual(first.indexCache.fastPartialQueryCacheHit, true);

  const second = await searchWorkspaceText(root, 'FAST_CACHE_NEEDLE', {
    ...options,
    searchSessionId: 'partial-cache-2',
    searchRevision: 2,
  });
  assert.equal(second.fastPartialQueryCacheHit, true);
  assert.equal(second.truncated, true);
  assert.deepEqual(
    second.matches.map((match) => match.path),
    first.matches.map((match) => match.path),
  );

  await workspaceFileOperations.write(root, 'tracked.ts', 'no old needle remains\n', undefined, false, false);
  const changed = await searchWorkspaceText(root, 'FAST_CACHE_NEEDLE', {
    ...options,
    searchRevision: 3,
  });
  assert.notEqual(changed.fastPartialQueryCacheHit, true);
  assert.deepEqual(changed.matches, []);
});

test('a negative Git preview falls back to the complete workspace scan', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-negative-'));
  const targetDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-git-text-negative-target-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(targetDirectory, { recursive: true, force: true }));
  initRepository(root);
  const target = join(targetDirectory, 'target.ts');
  await writeFile(target, 'SYMLINK_ONLY_NEEDLE\n', 'utf8');
  await symlink(target, join(root, 'linked.ts'));

  const preview = await searchWorkspaceText(root, 'SYMLINK_ONLY_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 40,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.deepEqual(preview.matches.map((match) => match.path), ['linked.ts']);
  assert.equal(preview.fastPartialTextSearch, undefined);
});
