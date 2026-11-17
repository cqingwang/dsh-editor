import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

test('chunked upload keeps the final path absent until finish', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-upload-partial-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('partial file must stay hidden until complete');
  const started = await workspaceFileOperations.startUpload(root, 'docs/final.bin', bytes.length);

  assert.deepEqual(await readdir(join(root, 'docs')), [
    `.dsh-editor-upload-${started.uploadId}.part`,
  ]);
  await workspaceFileOperations.writeUploadChunk(root, started.uploadId, 0, bytes.subarray(0, 12));
  await assert.rejects(() => readFile(join(root, 'docs/final.bin')), /ENOENT/u);

  await workspaceFileOperations.writeUploadChunk(root, started.uploadId, 12, bytes.subarray(12));
  await workspaceFileOperations.finishUpload(root, started.uploadId);

  assert.deepEqual(await readFile(join(root, 'docs/final.bin')), bytes);
  assert.deepEqual(await readdir(join(root, 'docs')), ['final.bin']);
});

test('abandoned upload does not reserve the final path or block a retry', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-upload-retry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('retry after abandoned chunk upload');
  const abandoned = await workspaceFileOperations.startUpload(root, 'retry.bin', bytes.length);
  await workspaceFileOperations.writeUploadChunk(root, abandoned.uploadId, 0, bytes.subarray(0, 7));

  const retried = await workspaceFileOperations.startUpload(root, 'retry.bin', bytes.length);
  assert.notEqual(retried.uploadId, abandoned.uploadId);
  for (const uploadId of [abandoned.uploadId, retried.uploadId]) {
    await workspaceFileOperations.abortUpload(root, uploadId).catch(() => {});
  }
  await assert.rejects(() => readFile(join(root, 'retry.bin')), /ENOENT/u);
});

test('the host owns idle cleanup for uploads abandoned by a reloaded page', async () => {
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  assert.match(host, /const UPLOAD_TEMP_TTL_MS = 60 \* 60 \* 1000/u);
  assert.match(host, /function scheduleUploadIdleCleanup\(upload\)/u);
  assert.match(host, /activeWorkspaceUploads\.delete\(upload\.uploadId\)/u);
  assert.match(host, /void unlink\(upload\.partial\)\.catch/u);
  assert.match(host, /timer\.unref\?\.\(\)/u);
  assert.match(host, /if \(isUploadTempName\(row\.name\)\) continue/u);
  assert.match(host, /if \(isUploadTempName\(basename\(normalized\)\)\) return/u);
});
