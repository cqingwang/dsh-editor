import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText, workspaceFileOperations } from '../lib/index.js';

test('aborted text search returns before traversing or reading workspace files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-search-abort-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'first.txt'), 'needle\n', 'utf8');
  await writeFile(join(root, 'second.txt'), 'needle\n', 'utf8');

  const controller = new AbortController();
  controller.abort();
  const result = await searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    signal: controller.signal,
  });

  assert.deepEqual(result.matches, []);
  assert.equal(result.truncated, false);
  assert.equal(result.visitedFiles, 0);
});

test('an in-flight text search stops reading after cancellation', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-search-in-flight-abort-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fileCount = 500;
  await Promise.all(
    Array.from({ length: fileCount }, (_, index) =>
      writeFile(join(root, `file-${index}.txt`), 'unrelated content\n'.repeat(20), 'utf8'),
    ),
  );

  const controller = new AbortController();
  const pending = searchWorkspaceText(root, 'needle-that-does-not-exist', {
    maxMatches: 200,
    signal: controller.signal,
  });
  await new Promise((resolve) => setTimeout(resolve, 1));
  controller.abort();
  const result = await pending;

  assert.deepEqual(result.matches, []);
  assert.equal(result.truncated, false);
  assert.ok(result.visitedFiles < fileCount, `expected cancellation before all ${fileCount} files were read`);
});

test('aborted file enumeration returns no cached candidates', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-file-search-abort-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'visible.txt'), 'needle\n', 'utf8');

  const controller = new AbortController();
  controller.abort();
  const files = await workspaceFileOperations.files(root, 2000, {
    signal: controller.signal,
  });

  assert.deepEqual(files.files, []);
  assert.equal(files.truncated, false);
});
