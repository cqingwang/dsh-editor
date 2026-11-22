import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText } from '../lib/index.js';

test('default text search does not stop after the former 2,000-file live-scan cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-no-file-cap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fileCount = 2_100;
  const needle = 'MATCH_AFTER_OLD_FILE_CAP';
  for (let start = 0; start < fileCount; start += 200) {
    await Promise.all(
      Array.from({ length: Math.min(200, fileCount - start) }, (_, offset) => {
        const index = start + offset;
        return writeFile(
          join(root, `source-${String(index).padStart(4, '0')}.txt`),
          index === fileCount - 1 ? `${needle}\n` : 'plain text\n',
          'utf8',
        );
      }),
    );
  }

  const result = await searchWorkspaceText(root, needle, { maxMatches: 20 });
  assert.deepEqual(
    result.matches.map((match) => match.path),
    [`source-${String(fileCount - 1).padStart(4, '0')}.txt`],
  );
  assert.equal(result.truncated, false);
});
