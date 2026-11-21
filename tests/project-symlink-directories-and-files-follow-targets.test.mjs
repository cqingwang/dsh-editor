import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText, workspaceFileOperations } from '../lib/index.js';

async function symlinkFixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'dsh-editor-symlink-'));
  const root = join(base, 'workspace');
  const external = join(base, 'external');
  const externalDirectory = join(external, 'linked-directory');
  const externalFile = join(external, 'linked-file.txt');
  await mkdir(join(externalDirectory, 'nested'), { recursive: true });
  await mkdir(root, { recursive: true });
  await writeFile(join(externalDirectory, 'nested', 'inside.txt'), 'symlink-needle\n');
  await writeFile(externalFile, 'symlink-needle\n');
  await symlink(externalDirectory, join(root, 'linked-dir'), 'dir');
  await symlink(externalFile, join(root, 'linked-file.txt'));
  await symlink(root, join(root, 'loop'), 'dir');
  t.after(() => rm(base, { recursive: true, force: true }));
  return { root, externalDirectory, externalFile };
}

test('symlink directories and files participate in Project and search candidates', async (t) => {
  if (process.platform === 'win32') t.skip('symlink fixture targets Linux/macOS semantics');
  const { root } = await symlinkFixture(t);

  const files = await workspaceFileOperations.files(root, 100, { includeExcluded: true });
  assert.deepEqual(files.files.sort(), ['linked-dir/nested/inside.txt', 'linked-file.txt']);
  assert.equal(files.truncated, false);

  const directories = await workspaceFileOperations.directories(root, 100);
  assert.ok(directories.directories.includes('linked-dir'));
  assert.ok(directories.directories.includes('loop'));
  assert.equal(directories.truncated, false);

  const entries = await workspaceFileOperations.search(root, 'inside', {
    showHidden: true,
    sort: 'name',
    foldersFirst: true,
  });
  assert.deepEqual(
    entries.entries.map((entry) => [entry.path, entry.kind]),
    [['linked-dir/nested/inside.txt', 'file']],
  );
  assert.equal(entries.truncated, false);
});

test('text search follows symlink files and directories without traversing cycles', async (t) => {
  if (process.platform === 'win32') t.skip('symlink fixture targets Linux/macOS semantics');
  const { root, externalDirectory, externalFile } = await symlinkFixture(t);

  const result = await searchWorkspaceText(root, 'symlink-needle', { maxMatches: 20 });
  assert.deepEqual(result.matches.map((match) => match.path).sort(), [
    'linked-dir/nested/inside.txt',
    'linked-file.txt',
  ]);
  assert.equal(result.truncated, false);
  assert.equal(result.matches.some((match) => match.path.includes('loop/loop')), false);

  assert.equal(await readFile(externalFile, 'utf8'), 'symlink-needle\n');
  assert.equal(await readFile(join(externalDirectory, 'nested', 'inside.txt'), 'utf8'), 'symlink-needle\n');
});

test('Replace in Files writes symlink targets and preserves the links', async (t) => {
  if (process.platform === 'win32') t.skip('symlink fixture targets Linux/macOS semantics');
  const { root, externalDirectory, externalFile } = await symlinkFixture(t);
  const found = await searchWorkspaceText(root, 'symlink-needle', { maxMatches: 20 });
  const targets = await Promise.all(
    found.matches.map(async (match) => ({
      path: match.path,
      mtime: (await stat(join(root, match.path))).mtimeMs,
    })),
  );

  const summary = await workspaceFileOperations.replaceText(
    root,
    'symlink-needle',
    'symlink-replaced',
    targets,
  );

  assert.equal(summary.changedFiles, 2);
  assert.equal(summary.replacements, 2);
  assert.equal((await lstat(join(root, 'linked-dir'))).isSymbolicLink(), true);
  assert.equal((await lstat(join(root, 'linked-file.txt'))).isSymbolicLink(), true);
  assert.equal(await readFile(join(externalDirectory, 'nested', 'inside.txt'), 'utf8'), 'symlink-replaced\n');
  assert.equal(await readFile(externalFile, 'utf8'), 'symlink-replaced\n');
});

test('multi-level directory links resolve once and broken links stay hidden', async (t) => {
  if (process.platform === 'win32') t.skip('symlink fixture targets Linux/macOS semantics');
  const base = await mkdtemp(join(tmpdir(), 'dsh-editor-symlink-chain-'));
  const root = join(base, 'workspace');
  const external = join(base, 'external');
  await mkdir(join(external, 'nested'), { recursive: true });
  await mkdir(root, { recursive: true });
  await writeFile(join(external, 'nested', 'inside.txt'), 'chain-needle\n');
  await symlink(external, join(root, 'first-link'), 'dir');
  await symlink(join(root, 'first-link'), join(root, 'second-link'), 'dir');
  await symlink(join(base, 'missing-target'), join(root, 'broken-link'));
  t.after(() => rm(base, { recursive: true, force: true }));

  const files = await workspaceFileOperations.files(root, 100, { includeExcluded: true });
  assert.ok(files.files.includes('first-link/nested/inside.txt'));
  assert.equal(files.files.some((path) => path.startsWith('second-link/')), false);
  assert.equal(files.files.includes('broken-link'), false);

  const directories = await workspaceFileOperations.directories(root, 100);
  assert.ok(directories.directories.includes('first-link'));
  assert.ok(directories.directories.includes('second-link'));
  assert.equal(directories.directories.includes('broken-link'), false);

  const result = await searchWorkspaceText(root, 'chain-needle', { maxMatches: 10 });
  assert.deepEqual(result.matches.map((match) => match.path), ['first-link/nested/inside.txt']);
  assert.equal(result.truncated, false);
});

test('an unreadable symlink target does not abort Project or text search', async (t) => {
  if (process.platform === 'win32') t.skip('POSIX permission fixture');
  const base = await mkdtemp(join(tmpdir(), 'dsh-editor-symlink-permission-'));
  const root = join(base, 'workspace');
  const external = join(base, 'external');
  await mkdir(join(external, 'locked'), { recursive: true });
  await mkdir(root, { recursive: true });
  await writeFile(join(external, 'locked', 'hidden.txt'), 'permission-needle\n');
  await writeFile(join(root, 'readable.txt'), 'permission-needle\n');
  await symlink(external, join(root, 'external-link'), 'dir');
  await chmod(join(external, 'locked'), 0o000);
  t.after(async () => {
    await chmod(join(external, 'locked'), 0o700).catch(() => {});
    await rm(base, { recursive: true, force: true });
  });

  const files = await workspaceFileOperations.files(root, 100, { includeExcluded: true });
  assert.ok(files.files.includes('readable.txt'));
  assert.equal(files.files.some((path) => path.endsWith('hidden.txt')), false);

  const result = await searchWorkspaceText(root, 'permission-needle', { maxMatches: 10 });
  assert.deepEqual(result.matches.map((match) => match.path), ['readable.txt']);
});
