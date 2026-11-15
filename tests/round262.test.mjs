import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r262-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'sort-dir'));
  await writeFile(join(root, 'sort-a.txt'), 'a\n');
  await writeFile(join(root, 'sort-b.md'), 'b\n');
  await writeFile(join(root, 'sort-c.ts'), 'c\n');
  await utimes(join(root, 'sort-a.txt'), new Date('2020-01-01'), new Date('2020-01-01'));
  await utimes(join(root, 'sort-b.md'), new Date('2021-01-01'), new Date('2021-01-01'));
  await utimes(join(root, 'sort-c.ts'), new Date('2022-01-01'), new Date('2022-01-01'));
  return root;
}

test('recursive Project search respects name, type and modified ordering', async (t) => {
  const root = await fixture(t);
  const paths = async (sort) => (await workspaceFileOperations.search(root, 'sort-', {
    showHidden: true,
    showExcluded: true,
    sort,
    foldersFirst: true,
  })).entries.map((entry) => entry.path);

  assert.deepEqual(await paths('name'), ['sort-dir', 'sort-a.txt', 'sort-b.md', 'sort-c.ts']);
  assert.deepEqual(await paths('type'), ['sort-dir', 'sort-b.md', 'sort-c.ts', 'sort-a.txt']);
  assert.deepEqual(await paths('modified'), ['sort-dir', 'sort-c.ts', 'sort-b.md', 'sort-a.txt']);
  assert.deepEqual(await paths('modified-asc'), ['sort-dir', 'sort-a.txt', 'sort-b.md', 'sort-c.ts']);
});

test('recursive Project search respects Folders Always on Top', async (t) => {
  const root = await fixture(t);
  const result = await workspaceFileOperations.search(root, 'sort-', {
    showHidden: true,
    showExcluded: true,
    sort: 'name',
    foldersFirst: false,
  });
  assert.deepEqual(result.entries.map((entry) => entry.path), ['sort-a.txt', 'sort-b.md', 'sort-c.ts', 'sort-dir']);
});
