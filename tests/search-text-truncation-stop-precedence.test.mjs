import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText } from '../lib/index.js';

test('abort, match cap and byte budget stop text search with truthful truncation state', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-stop-precedence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(
    Array.from({ length: 2500 }, (_, index) =>
      writeFile(
        join(root, `precedence-${String(index).padStart(4, '0')}.ts`),
        `${index < 2000 && index % 100 === 0 ? 'PRECEDENCE_NEEDLE' : 'ordinary content'} ${'x'.repeat(900)}\n`,
        'utf8',
      ),
    ),
  );

  const capped = await searchWorkspaceText(root, 'PRECEDENCE_NEEDLE', {
    maxMatches: 3,
    searchIndex: false,
  });
  assert.equal(capped.truncated, true);
  assert.deepEqual(
    capped.matches.map((match) => match.path),
    ['precedence-0000.ts', 'precedence-0100.ts', 'precedence-0200.ts'],
  );

  const budgeted = await searchWorkspaceText(root, 'PRECEDENCE_NEEDLE', {
    maxMatches: 200,
    maxBytes: 1200,
    searchIndex: false,
  });
  assert.equal(budgeted.truncated, true);
  assert.deepEqual(
    budgeted.matches.map((match) => match.path),
    ['precedence-0000.ts'],
  );
  assert.ok(budgeted.scannedBytes <= 1200);

  const controller = new AbortController();
  controller.abort();
  const aborted = await searchWorkspaceText(root, 'PRECEDENCE_NEEDLE', {
    maxMatches: 200,
    searchIndex: false,
    signal: controller.signal,
  });
  assert.equal(aborted.truncated, false);
  assert.equal(aborted.visitedFiles, 0);
  assert.equal(aborted.scannedBytes, 0);
  assert.deepEqual(aborted.matches, []);
});
