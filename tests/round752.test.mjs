import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';
import { loadTypeScriptFunction } from './ts-source.mjs';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
const imagePaneSource = await readFile(
  new URL('../src/client/components/editor/ImagePreviewPane.tsx', import.meta.url),
  'utf8',
);
const editorPathModel = await readFile(
  new URL('../src/client/components/editor/editor-path-model.ts', import.meta.url),
  'utf8',
);
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xQAAAAASUVORK5CYII=',
  'base64',
);

test('host reports image metadata without reading image bytes as text', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-image-info-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'assets', 'pixel.png'), pixel);
  await writeFile(join(root, 'assets', 'notes.txt'), 'not an image');

  const info = await workspaceFileOperations.imageInfo(root, 'assets/pixel.png');
  assert.deepEqual(info, {
    path: 'assets/pixel.png',
    size: pixel.length,
    mtime: info.mtime,
    mediaType: 'image/png',
  });
  assert.ok(Number.isFinite(info.mtime));

  await assert.rejects(() => workspaceFileOperations.imageInfo(root, 'assets/notes.txt'), /not a supported image/u);
  await assert.rejects(() => workspaceFileOperations.imageInfo(root, '../escape.png'), /path escapes the workspace/u);
});

test('client recognises common browser-renderable image extensions', () => {
  const isImage = loadTypeScriptFunction(editorPathModel, 'isImagePreviewPath');
  for (const path of ['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.webp', 'a.avif', 'a.bmp', 'a.ico', 'a.svg']) {
    assert.equal(isImage(path), true, path);
  }
  assert.equal(isImage('a.txt'), false);
  assert.equal(isImage('a.png.txt'), false);
});

test('image tabs use a host image route and native browser preview', () => {
  assert.match(host, /path: '\/api\/dsh-editor\/image'/u);
  assert.match(host, /case 'image':/u);
  assert.match(host, /function imageFileResponse\(/u);
  assert.match(host, /'content-type': mediaType/u);
  assert.match(imagePaneSource, /function ImagePreviewPane\(/u);
  assert.match(imagePaneSource, /<img/u);
  assert.match(client, /kind: 'image'/u);
  assert.match(client, /op: 'image'/u);
  assert.match(imagePaneSource, /data-dsh-editor-image-preview/u);
  assert.match(client, /imagePreview: '图片预览'/u);
  assert.match(client, /imagePreview: 'Image preview'/u);
});
