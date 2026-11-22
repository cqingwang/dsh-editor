import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex } from '../lib/index.js';

test('a rebuilt index retains search-directory scope for the text fast path', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-rules-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-rules-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'src', 'kept.ts'), 'SCOPED_FAST_NEEDLE kept\n', 'utf8');
  await writeFile(join(root, 'docs', 'dropped.ts'), 'SCOPED_FAST_NEEDLE dropped\n', 'utf8');
  const searchDirectoryRules = {
    excludedDirectories: ['docs'],
    includedDirectories: [],
  };

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path-rules=${Date.now()}`, import.meta.url)
  );
  await freshHost.rebuildWorkspaceSearchIndex(root, {
    searchDirectoryRules,
    searchIndexDirectory: indexDirectory,
  });
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const result = await freshHost.searchWorkspaceText(root, 'SCOPED_FAST_NEEDLE', {
    searchDirectoryRules,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });

  assert.equal(result.indexFastPath, true);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['src/kept.ts'],
  );
});

test('a complete scoped search refreshes a changed index scope signature', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-recover-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-recover-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'docs'));
  await writeFile(join(root, 'src', 'kept.ts'), 'RECOVER_SCOPE_NEEDLE kept\n', 'utf8');
  await writeFile(join(root, 'docs', 'dropped.ts'), 'RECOVER_SCOPE_NEEDLE dropped\n', 'utf8');
  const searchDirectoryRules = {
    excludedDirectories: ['docs'],
    includedDirectories: [],
  };

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path-recover=${Date.now()}`, import.meta.url)
  );
  await freshHost.rebuildWorkspaceSearchIndex(root, {
    searchIndexDirectory: indexDirectory,
  });
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const request = {
    searchDirectoryRules,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  };

  const first = await freshHost.searchWorkspaceText(root, 'RECOVER_SCOPE_NEEDLE', request);
  assert.notEqual(first.indexFastPath, true);
  assert.deepEqual(
    first.matches.map((match) => match.path),
    ['src/kept.ts'],
  );

  const recovered = await freshHost.searchWorkspaceText(root, 'RECOVER_SCOPE_NEEDLE', request);
  assert.equal(recovered.indexFastPath, true);
  assert.deepEqual(
    recovered.matches.map((match) => match.path),
    ['src/kept.ts'],
  );
});

test('a text-search scope refresh invalidates stale directory fast-path coverage', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-directories-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-directories-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await mkdir(join(root, 'docs', 'empty-dir'), { recursive: true });
  await writeFile(join(root, 'src', 'kept.ts'), 'export {};\n', 'utf8');
  const excludedDocs = {
    excludedDirectories: ['docs'],
    includedDirectories: [],
  };
  const allDirectories = {
    excludedDirectories: [],
    includedDirectories: [],
  };

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path-directories=${Date.now()}`, import.meta.url)
  );
  await freshHost.rebuildWorkspaceSearchIndex(root, {
    searchDirectoryRules: excludedDocs,
    searchIndexDirectory: indexDirectory,
  });
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const scopedText = await freshHost.searchWorkspaceText(root, 'NO_MATCH_NEEDLE', {
    searchDirectoryRules: allDirectories,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.notEqual(scopedText.indexFastPath, true);

  const request = {
    respectGitIgnore: true,
    searchDirectoryRules: allDirectories,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
    maxVisited: 20,
  };
  const first = await freshHost.workspaceFileOperations.search(root, 'empty-dir', request);
  assert.equal(first.indexFastPath, true);
  assert.deepEqual(
    first.entries.map((entry) => entry.path),
    ['docs/empty-dir'],
  );

  const recovered = await freshHost.workspaceFileOperations.search(root, 'empty-dir', {
    ...request,
    maxVisited: 1,
  });
  assert.equal(recovered.indexFastPath, true);
  assert.deepEqual(
    recovered.entries.map((entry) => entry.path),
    ['docs/empty-dir'],
  );
});

test('a complete fresh project index serves text-search paths without a live walk', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'FAST_PATH_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'ordinary beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path=${Date.now()}`, import.meta.url)
  );
  const withoutWatcher = await freshHost.searchWorkspaceText(root, 'FAST_PATH_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.notEqual(withoutWatcher.indexFastPath, true);
  assert.deepEqual(
    withoutWatcher.matches.map((match) => match.path),
    ['alpha.ts'],
  );

  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const cached = await freshHost.searchWorkspaceText(root, 'FAST_PATH_NEEDLE', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(cached.indexFastPath, true);
  assert.equal(cached.indexCache.hits, 2);
  assert.equal(cached.indexCache.misses, 0);
  assert.deepEqual(
    cached.matches.map((match) => match.path),
    ['alpha.ts'],
  );
});

test('text-search path fast path preserves the live breadth-first result order', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-order-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-order-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await mkdir(join(root, 'alpha', 'nested'), { recursive: true });
  await mkdir(join(root, 'beta'));
  await writeFile(join(root, 'root.ts'), 'ORDER_NEEDLE root\n', 'utf8');
  await writeFile(join(root, 'alpha', 'a.ts'), 'ORDER_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'alpha', 'nested', 'z.ts'), 'ORDER_NEEDLE nested\n', 'utf8');
  await writeFile(join(root, 'beta', 'b.ts'), 'ORDER_NEEDLE beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path-order=${Date.now()}`, import.meta.url)
  );
  const request = { searchIndex: true, searchIndexDirectory: indexDirectory };
  const live = await freshHost.searchWorkspaceText(root, 'ORDER_NEEDLE', request);
  assert.notEqual(live.indexFastPath, true);

  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const cached = await freshHost.searchWorkspaceText(root, 'ORDER_NEEDLE', request);
  assert.equal(cached.indexFastPath, true);
  assert.deepEqual(
    cached.matches.map((match) => match.path),
    live.matches.map((match) => match.path),
  );
});

test('text-search path fast path filters scopes from the index and falls back when appropriate', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-fallback-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-fast-path-fallback-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha.ts'), 'FALLBACK_NEEDLE alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'FALLBACK_NEEDLE beta\n', 'utf8');
  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });

  const freshHost = await import(
    new URL(`../lib/index.js?text-fast-path-fallback=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  const request = {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  };

  const allowedPaths = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', {
    ...request,
    allowedPaths: ['beta.ts'],
  });
  assert.notEqual(allowedPaths.indexFastPath, true);
  assert.deepEqual(
    allowedPaths.matches.map((match) => match.path),
    ['beta.ts'],
  );

  const explicitScope = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', {
    ...request,
    scopeIncludePatterns: ['alpha.ts'],
  });
  assert.equal(explicitScope.indexFastPath, true);
  assert.deepEqual(
    explicitScope.matches.map((match) => match.path),
    ['alpha.ts'],
  );

  const included = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', {
    ...request,
    includeExcluded: true,
  });
  assert.notEqual(included.indexFastPath, true);
  assert.deepEqual(
    included.matches.map((match) => match.path),
    ['alpha.ts', 'beta.ts'],
  );

  await writeFile(join(root, 'gamma.ts'), 'FALLBACK_NEEDLE gamma\n', 'utf8');
  watcher.record('', 'gamma.ts');
  const stale = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', request);
  assert.notEqual(stale.indexFastPath, true);
  assert.deepEqual(
    stale.matches.map((match) => match.path),
    ['alpha.ts', 'beta.ts', 'gamma.ts'],
  );

  const recovered = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', request);
  assert.equal(recovered.indexFastPath, true);
  assert.deepEqual(
    recovered.matches.map((match) => match.path),
    ['alpha.ts', 'beta.ts', 'gamma.ts'],
  );

  await rm(join(root, 'beta.ts'));
  watcher.record('', 'beta.ts');
  const afterDelete = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', request);
  assert.notEqual(afterDelete.indexFastPath, true);
  assert.deepEqual(
    afterDelete.matches.map((match) => match.path),
    ['alpha.ts', 'gamma.ts'],
  );
  const deleteRecovered = await freshHost.searchWorkspaceText(root, 'FALLBACK_NEEDLE', request);
  assert.equal(deleteRecovered.indexFastPath, true);
  assert.deepEqual(
    deleteRecovered.matches.map((match) => match.path),
    ['alpha.ts', 'gamma.ts'],
  );
});
