import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { rebuildWorkspaceSearchIndex, searchWorkspaceText } from '../lib/index.js';

test('a truncated candidate list does not stop text search after the first matching file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-truncated-scan-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-text-truncated-scan-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const fileCount = 2500;
  const matchingIndexes = new Set([0, 100, 200, 300, 400, 2100]);
  await Promise.all(
    Array.from({ length: fileCount }, (_, index) =>
      writeFile(
        join(root, `scan-${String(index).padStart(4, '0')}.ts`),
        `${matchingIndexes.has(index) ? 'TRUNCATED_SCAN_NEEDLE' : 'ordinary content'}\n`,
        'utf8',
      ),
    ),
  );

  const result = await searchWorkspaceText(root, 'TRUNCATED_SCAN_NEEDLE', {
    maxMatches: 200,
    searchIndex: false,
  });
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((match) => match.path),
    ['scan-0000.ts', 'scan-0100.ts', 'scan-0200.ts', 'scan-0300.ts', 'scan-0400.ts'],
  );

  await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  const indexed = await searchWorkspaceText(root, 'TRUNCATED_SCAN_NEEDLE', {
    maxMatches: 200,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.equal(indexed.truncated, true);
  assert.deepEqual(
    indexed.matches.map((match) => match.path),
    [
      'scan-0000.ts',
      'scan-0100.ts',
      'scan-0200.ts',
      'scan-0300.ts',
      'scan-0400.ts',
      'scan-2100.ts',
    ],
  );
});
