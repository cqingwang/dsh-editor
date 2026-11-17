import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

test('writeBinary accepts base64 content beyond the JavaScript regex stack limit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-large-upload-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.alloc(5 * 1024 * 1024, 0xa5);

  const written = await workspaceFileOperations.writeBinary(root, 'large.bin', bytes.toString('base64'));

  assert.equal(written.size, bytes.length);
  assert.deepEqual(await readFile(join(root, 'large.bin')), bytes);
});
