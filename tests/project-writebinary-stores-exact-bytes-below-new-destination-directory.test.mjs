import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const client = (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

/**
 * Create one throwaway workspace root.
 * @returns {Promise<{root: string, cleanup: () => Promise<void>}>} fixture handle.
 */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-drop-'));
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('writeBinary stores exact bytes below a new destination directory', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  const bytes = Buffer.from([0, 1, 2, 0x7f, 0x80, 0xff]);

  const written = await workspaceFileOperations.writeBinary(root, 'nested/image.bin', bytes.toString('base64'));

  assert.deepEqual(written, {
    path: 'nested/image.bin',
    size: bytes.length,
    mtime: written.mtime,
  });
  assert.ok(Number.isFinite(written.mtime));
  assert.deepEqual(await readFile(join(root, 'nested/image.bin')), bytes);
});

test('writeBinary refuses overwrite, traversal and malformed base64', async (t) => {
  const { root, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(root, 'keep.bin'), 'keep');

  await assert.rejects(
    () => workspaceFileOperations.writeBinary(root, 'keep.bin', Buffer.from('replace').toString('base64')),
    /keep\.bin already exists/u,
  );
  assert.equal(await readFile(join(root, 'keep.bin'), 'utf8'), 'keep');
  await assert.rejects(
    () => workspaceFileOperations.writeBinary(root, '../escape.bin', Buffer.from('x').toString('base64')),
    /path escapes the workspace/u,
  );
  await assert.rejects(
    () => workspaceFileOperations.writeBinary(root, 'bad.bin', 'not base64!'),
    /invalid base64/u,
  );
  await assert.rejects(() => stat(join(root, 'bad.bin')));
});

test('Project uses operating-system Files drops without breaking tree moves', () => {
  assert.match(client, /function dataTransferIncludesFiles\(dataTransfer\)/u);
  assert.match(client, /webkitGetAsEntry/u);
  assert.match(client, /async function collectDroppedWorkspaceEntries\(/u);
  assert.match(client, /event\.dataTransfer\.dropEffect = 'copy'/u);
  assert.match(client, /onUpload\(handles, targetDirectory\)/u);
  assert.match(client, /dataTransferIncludesFiles\(event\.dataTransfer\)/u);
  assert.match(client, /split\('\\n'\)/u);
});

test('Project uploads preflight every destination before starting chunked files', () => {
  const start = client.indexOf('async function uploadWorkspaceDropToProject');
  const end = client.indexOf('function ProjectPanel', start);
  const upload = client.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(upload, /op: 'exists'/u);
  assert.match(upload, /uploadConflicts/u);
  assert.match(upload, /uploadWorkspaceFile\(\s*entry\.file,\s*destinationOf\(entry\.path\),/u);
  assert.match(client, /file\.slice\(offset, end\)\.arrayBuffer\(\)/u);
  assert.match(client, /requestWorkspaceUpload\('start'/u);
  assert.match(client, /uploadProjectDropWithGuard\(/u);
  assert.match(client, /useProjectUploadDrop\(\{/u);
});
