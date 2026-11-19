import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { listWorkspaceDirectoryForPicker } from '../lib/index.js';

test('the Web workspace picker host route lists directories without exposing files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-picker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src', 'nested'), { recursive: true });
  await mkdir(join(root, '.hidden'), { recursive: true });
  await writeFile(join(root, 'README.md'), 'not a directory\n');

  const listing = await listWorkspaceDirectoryForPicker(root);

  assert.equal(listing.path, root);
  assert.ok(listing.home !== '');
  assert.deepEqual(
    listing.entries.map((entry) => ({ name: entry.name, hidden: entry.hidden })),
    [
      { name: '.hidden', hidden: true },
      { name: 'src', hidden: false },
    ],
  );
  assert.ok(listing.entries.every((entry) => entry.path.startsWith(root)));
});

test('the Web workspace picker rejects relative paths and plain files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-workspace-picker-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'file.txt');
  await writeFile(file, 'x\n');

  await assert.rejects(() => listWorkspaceDirectoryForPicker('relative/path'), /must be absolute/u);
  await assert.rejects(() => listWorkspaceDirectoryForPicker(file), /not a directory/u);
});
