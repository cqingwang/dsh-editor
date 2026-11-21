import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');

test('Project speed search does not report truncation at an exact match cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-speed-search-cap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 200; index += 1) {
    await writeFile(join(root, `needle-${String(index).padStart(3, '0')}.txt`), 'needle\n', 'utf8');
  }

  const result = await host.workspaceFileOperations.search(root, 'needle-', {
    showHidden: true,
    showExcluded: true,
  });
  assert.equal(result.entries.length, 200);
  assert.equal(result.truncated, false);
});
