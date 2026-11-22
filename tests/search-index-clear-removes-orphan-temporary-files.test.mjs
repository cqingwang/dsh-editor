import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';

import {
  clearWorkspaceSearchIndex,
  searchIndexIdentity,
  writeWorkspaceSearchIndex,
} from '../lib/index.js';

test('clearing a workspace index also removes crash-left temporary snapshots', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-temp-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-clear-temp-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const identity = searchIndexIdentity(root, { searchIndexDirectory: indexDirectory });
  await writeWorkspaceSearchIndex(identity, {
    version: 2,
    root: identity.root,
    updatedAt: 1,
    contentBytes: 0,
    files: {},
  });
  const orphan = join(dirname(identity.file), `.${basename(identity.file)}.999-dead.tmp`);
  const unrelated = join(dirname(identity.file), '.another-index.tmp');
  await writeFile(orphan, 'partial');
  await writeFile(unrelated, 'keep');

  const cleared = await clearWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(cleared.cleared, true);
  const entries = await readdir(indexDirectory);
  assert.equal(entries.includes(basename(identity.file)), false);
  assert.equal(entries.includes(basename(orphan)), false);
  assert.equal(entries.includes(basename(unrelated)), true);
});
