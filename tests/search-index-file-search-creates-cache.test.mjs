import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchIndexIdentity, workspaceFileOperations } from '../lib/index.js';

async function waitForIndexFile(root, indexDirectory) {
  const file = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory }).file;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const info = await stat(file).catch(() => null);
    if (info?.isFile() === true && info.size > 0) return file;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`search index was not persisted: ${file}`);
}

test('a filename search creates the project index after a cache miss', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'alpha-target.ts'), 'alpha\n', 'utf8');
  await writeFile(join(root, 'beta.ts'), 'beta\n', 'utf8');

  const first = await workspaceFileOperations.search(root, 'alpha-target', {
    maxVisited: 20,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    first.entries.map((entry) => entry.path),
    ['alpha-target.ts'],
  );
  await waitForIndexFile(root, indexDirectory);

  // A fresh module instance must use the persisted path cache beyond its live traversal budget.
  const freshHost = await import(
    new URL(`../lib/index.js?filename-cache=${Date.now()}`, import.meta.url)
  );
  const second = await freshHost.workspaceFileOperations.search(root, 'beta', {
    maxVisited: 1,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    second.entries.map((entry) => entry.path),
    ['beta.ts'],
  );
});

test('a filename search settles its index write before reporting completion', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-settled-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-settled-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'settled-target.ts'), 'settled\n', 'utf8');

  const result = await workspaceFileOperations.search(root, 'settled-target', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.path),
    ['settled-target.ts'],
  );

  const file = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory }).file;
  const persisted = await stat(file).catch(() => null);
  assert.equal(persisted?.isFile(), true, 'search returned while the index write was still in flight');
});

test('a filename search still writes its path cache when the live result cap is reached', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-cap-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-filename-cache-cap-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 205 }, (_, index) =>
      writeFile(join(root, `hit-${String(index).padStart(3, '0')}.ts`), 'hit\n', 'utf8'),
    ),
  );

  const result = await workspaceFileOperations.search(root, 'hit-', {
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(result.entries.length, 200);
  assert.equal(result.truncated, true);
  await waitForIndexFile(root, indexDirectory);
});
