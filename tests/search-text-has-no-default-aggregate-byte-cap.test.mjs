import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText } from '../lib/index.js';

test('default text search does not stop after the former 64 MiB aggregate budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-no-byte-cap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fileCount = 66;
  const needle = 'MATCH_AFTER_OLD_BYTE_CAP';
  for (let start = 0; start < fileCount; start += 8) {
    await Promise.all(
      Array.from({ length: Math.min(8, fileCount - start) }, (_, offset) => {
        const index = start + offset;
        const payload =
          index === fileCount - 1
            ? `${'x'.repeat(1_200_000)}${needle}\n`
            : 'x'.repeat(1_048_500);
        return writeFile(join(root, `large-${String(index).padStart(3, '0')}.txt`), payload, 'utf8');
      }),
    );
  }

  const result = await searchWorkspaceText(root, needle, { maxMatches: 20 });
  assert.deepEqual(
    result.matches.map((match) => match.path),
    [`large-${String(fileCount - 1).padStart(3, '0')}.txt`],
  );
  assert.equal(result.truncated, false);
  assert.ok(result.scannedBytes > 64 * 1024 * 1024);
});
