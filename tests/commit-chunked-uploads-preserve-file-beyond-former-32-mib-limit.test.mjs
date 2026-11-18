import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const CHUNK = 10 * 1024 * 1024;
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('chunked uploads preserve a file beyond the former 32 MiB limit', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-chunked-upload-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.alloc(36 * 1024 * 1024 + 137);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
  const started = await workspaceFileOperations.startUpload(root, 'large/movie.bin', bytes.length);
  let offset = 0;
  while (offset < bytes.length) {
    const end = Math.min(offset + CHUNK, bytes.length);
    const chunk = await workspaceFileOperations.writeUploadChunk(
      root,
      started.uploadId,
      offset,
      bytes.subarray(offset, end),
    );
    assert.equal(chunk.offset, end);
    offset = chunk.offset;
  }
  const written = await workspaceFileOperations.finishUpload(root, started.uploadId);

  assert.equal(written.path, 'large/movie.bin');
  assert.equal(written.size, bytes.length);
  const stored = await readFile(join(root, 'large/movie.bin'));
  assert.equal(stored.length, bytes.length);
  assert.equal(digest(stored), digest(bytes));
});

test('chunked upload reports the durable offset instead of overwriting after a stale retry', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-chunk-offset-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
  const started = await workspaceFileOperations.startUpload(root, 'offset.bin', bytes.length);
  const first = await workspaceFileOperations.writeUploadChunk(root, started.uploadId, 0, bytes.subarray(0, 10));
  assert.equal(first.offset, 10);

  await assert.rejects(
    () => workspaceFileOperations.writeUploadChunk(root, started.uploadId, 0, bytes.subarray(0, 10)),
    (error) => error?.code === 'dsh-editor/upload-offset' && error.currentOffset === 10,
  );

  const second = await workspaceFileOperations.writeUploadChunk(root, started.uploadId, 10, bytes.subarray(10));
  assert.equal(second.offset, bytes.length);
  await workspaceFileOperations.finishUpload(root, started.uploadId);
  assert.deepEqual(await readFile(join(root, 'offset.bin')), bytes);
});

test('aborting a chunked upload removes its reserved partial file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-chunk-abort-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bytes = Buffer.from('partial upload');
  const started = await workspaceFileOperations.startUpload(root, 'abort.bin', 1024);
  await workspaceFileOperations.writeUploadChunk(root, started.uploadId, 0, bytes);

  await workspaceFileOperations.abortUpload(root, started.uploadId);

  await assert.rejects(() => readFile(join(root, 'abort.bin')), /ENOENT/u);
});

test('Project upload transport uses sequential 10 MiB slices and bounded retries', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
  assert.match(source, /WORKSPACE_UPLOAD_CHUNK_BYTES = 10 \* 1024 \* 1024/u);
  assert.match(source, /WORKSPACE_UPLOAD_RETRY_DELAYS = \[0, 1000, 2000, 4000, 8000\]/u);
  assert.match(source, /file\.slice\(offset, end\)\.arrayBuffer\(\)/u);
  assert.match(source, /requestWorkspaceUpload\('start'/u);
  assert.doesNotMatch(source, /WORKSPACE_DROP_MAX_FILE_BYTES/u);
  assert.doesNotMatch(source, /contentBase64: bytesToBase64\(buffer\)/u);
  assert.match(host, /url\.searchParams\.get\('sessionId'\) \|\| \(typeof body\?\.sessionId/u);
  assert.match(host, /path: '\/api\/dsh-editor\/upload\/start'/u);
  assert.match(host, /path: '\/api\/dsh-editor\/upload\/chunk'/u);
});
