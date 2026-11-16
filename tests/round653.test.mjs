import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  commitWorkspaceReplacements,
  workspaceFileOperations,
} from '../lib/index.js';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const replaceAll = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);

test('A later clean write failure rolls earlier clean files back', async () => {
  const writes = [];
  const writer = async (_root, relativePath, content, expectedMtime, force) => {
    writes.push({ path: relativePath, content, expectedMtime, force });
    if (relativePath === 'b.txt' && force !== true) throw new Error('simulated disk failure');
    return { path: relativePath };
  };
  const staged = [
    { relativePath: 'a.txt', content: 'new-a', originalContent: 'old-a', count: 1, expectedMtime: 10 },
    { relativePath: 'b.txt', content: 'new-b', originalContent: 'old-b', count: 2, expectedMtime: 20 },
  ];

  await assert.rejects(
    () => commitWorkspaceReplacements('/workspace', staged, writer),
    /simulated disk failure/,
  );
  assert.deepEqual(writes, [
    { path: 'a.txt', content: 'new-a', expectedMtime: 10, force: false },
    { path: 'b.txt', content: 'new-b', expectedMtime: 20, force: false },
    { path: 'b.txt', content: 'old-b', expectedMtime: undefined, force: true },
    { path: 'a.txt', content: 'old-a', expectedMtime: undefined, force: true },
  ]);
});

test('Successful transactional replacement reports the staged counts', async () => {
  const writes = [];
  const writer = async (_root, relativePath, content) => {
    writes.push({ path: relativePath, content });
    return { path: relativePath };
  };
  const result = await commitWorkspaceReplacements('/workspace', [
    { relativePath: 'a.txt', content: 'new-a', originalContent: 'old-a', count: 1 },
    { relativePath: 'b.txt', content: 'new-b', originalContent: 'old-b', count: 2 },
  ], writer);
  assert.deepEqual(result, {
    changedFiles: 2,
    replacements: 3,
    files: ['a.txt', 'b.txt'],
  });
  assert.deepEqual(writes, [
    { path: 'a.txt', content: 'new-a' },
    { path: 'b.txt', content: 'new-b' },
  ]);
});

test('A stale mtime fails preflight before any clean file is written', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-r653-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'needle-a\n');
  await writeFile(join(root, 'b.txt'), 'needle-b\n');
  const aInfo = await stat(join(root, 'a.txt'));
  const bInfo = await stat(join(root, 'b.txt'));
  await writeFile(join(root, 'b.txt'), 'externally changed\n');
  await utimes(join(root, 'b.txt'), new Date(bInfo.mtimeMs + 5_000), new Date(bInfo.mtimeMs + 5_000));

  await assert.rejects(
    () => workspaceFileOperations.replaceText(root, 'needle', 'result', [
      { path: 'a.txt', mtime: aInfo.mtimeMs },
      { path: 'b.txt', mtime: bInfo.mtimeMs },
    ]),
    /changed on disk since it was searched/,
  );
  assert.equal(await readFile(join(root, 'a.txt'), 'utf8'), 'needle-a\n');
  assert.equal(await readFile(join(root, 'b.txt'), 'utf8'), 'externally changed\n');
});

test('Dirty plans remain after the host success boundary', () => {
  const hostCall = replaceAll.indexOf('await callFs({');
  const dirtyCommit = replaceAll.indexOf('commitFindToolDirtyPlans(dirtyPlans)');
  const catchAt = replaceAll.indexOf('} catch (failure) {', dirtyCommit);
  assert.ok(hostCall >= 0 && dirtyCommit > hostCall && catchAt > dirtyCommit);
  assert.doesNotMatch(replaceAll.slice(catchAt), /pushEditOperations/);
});
