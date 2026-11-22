import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText } from '../lib/index.js';

test('text search stops before its total byte budget is exhausted', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-byte-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = 'ordinary text without the query\n'.repeat(200);
  await writeFile(join(root, 'a.txt'), content, 'utf8');
  await writeFile(join(root, 'b.txt'), content, 'utf8');
  await writeFile(join(root, 'c.txt'), content, 'utf8');

  const result = await searchWorkspaceText(root, 'ABSENT_BYTE_BUDGET_QUERY', {
    maxMatches: 200,
    maxBytes: Buffer.byteLength(content) + 100,
  });

  assert.equal(result.matches.length, 0);
  assert.equal(result.truncated, true);
  assert.equal(result.visitedFiles, 1);
  assert.equal(result.scannedBytes, Buffer.byteLength(content));
});

test('an exact total byte budget that covers every file is not truncated', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-byte-budget-exact-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = 'ordinary text without the query\n'.repeat(100);
  await writeFile(join(root, 'a.txt'), content, 'utf8');
  await writeFile(join(root, 'b.txt'), content, 'utf8');

  const result = await searchWorkspaceText(root, 'ABSENT_BYTE_BUDGET_QUERY', {
    maxMatches: 200,
    maxBytes: Buffer.byteLength(content) * 2,
  });

  assert.equal(result.matches.length, 0);
  assert.equal(result.truncated, false);
  assert.equal(result.visitedFiles, 2);
  assert.equal(result.scannedBytes, Buffer.byteLength(content) * 2);
});
