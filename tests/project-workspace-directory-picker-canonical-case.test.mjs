import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalizeDirectoryCase, listWorkspaceDirectoryForPicker } from '../lib/index.js';

test('case-insensitive hosts return the directory path with its real case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-directory-case-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const actual = join(root, 'CaseParent', 'ChIlD');
  await mkdir(actual, { recursive: true });

  const requested = actual.toLowerCase();
  assert.equal(await canonicalizeDirectoryCase(requested, 'darwin'), actual);
  assert.equal(await canonicalizeDirectoryCase(requested, 'linux'), requested);
});

test('canonical case resolution preserves a symlink segment instead of resolving its target', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-directory-link-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'RealTarget');
  const link = join(root, 'LinkName');
  await mkdir(target);
  await symlink(target, link, 'dir');

  const requested = join(root, 'linkname');
  assert.equal(await canonicalizeDirectoryCase(requested, 'darwin'), link);
});

test('the Web workspace picker uses the canonical case path', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-directory-picker-case-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const actual = join(root, 'CaseParent');
  await mkdir(actual);

  const requested = actual.toLowerCase();
  const listing = await listWorkspaceDirectoryForPicker(requested);

  assert.equal(listing.path, actual);
});
