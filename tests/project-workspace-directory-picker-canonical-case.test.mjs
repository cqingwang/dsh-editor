import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalizeDirectoryCase, listWorkspaceDirectoryForPicker, workspaceFileOperations } from '../lib/index.js';

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

test('workspace path descriptions identify symlink aliases by file identity', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-path-identity-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'Widget.h');
  const link = join(root, 'widget-link.h');
  const distinct = join(root, 'Other.h');
  await writeFile(target, 'class Widget {};\n');
  await writeFile(distinct, 'class Other {};\n');
  await symlink(target, link);

  const described = await workspaceFileOperations.describe(root, [target, link, distinct]);
  assert.equal(described[0].exists, true);
  assert.equal(described[1].exists, true);
  assert.equal(typeof described[0].identity, 'string');
  assert.equal(described[0].identity, described[1].identity);
  assert.notEqual(described[0].identity, described[2].identity);
});
