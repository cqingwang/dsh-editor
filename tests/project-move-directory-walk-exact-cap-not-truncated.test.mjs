import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');

test('Move To directory walk does not report truncation at an exact cap', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-directory-cap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 999; index += 1) {
    await mkdir(join(root, `target-${String(index).padStart(3, '0')}`));
  }

  const result = await host.workspaceFileOperations.directories(root, 1000);
  assert.equal(result.directories.length, 1000);
  assert.equal(result.truncated, false);
});
