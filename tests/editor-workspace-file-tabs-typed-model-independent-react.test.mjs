import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('workspace file tabs use a typed model independent from React', async () => {
  const model = await read('src/client/components/editor/workspace-file-model.ts');

  assert.match(model, /export interface WorkspaceTextFile/u);
  assert.match(model, /export interface WorkspaceImageFile/u);
  assert.match(model, /export type WorkspaceFile = WorkspaceTextFile \| WorkspaceImageFile/u);
  assert.match(model, /export function workspaceFileFromResponse\(/u);
  assert.match(model, /export function workspaceReloadOperation\(/u);
  assert.match(model, /export function workspaceFileAfterReload\(/u);
  assert.doesNotMatch(model, /from 'react'/u);
  assert.doesNotMatch(model, /React\./u);
});

test('workspace image preview builder uses XML-style JSX', async () => {
  const builder = await read('src/client/components/editor/workspace-image-preview.tsx');

  assert.match(builder, /export function workspaceImagePreviewElement\(/u);
  assert.match(builder, /<ImagePreviewPane/u);
  assert.match(builder, /key=\{path\}/u);
  assert.match(builder, /src=\{imagePreviewUrl\(path, file\?\.mtime\)\}/u);
  assert.match(builder, /mediaType=\{file\?\.mediaType \?\? ''\}/u);
  assert.match(builder, /onActivate=\{\(\) => onActivate\?\.\(path\)\}/u);
  assert.doesNotMatch(builder, /React\.createElement/u);
});

test('build embeds the workspace model and removes the legacy helpers', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/editor-core.ts');

  assert.match(build, /workspace-file-model\.ts/u);
  assert.match(build, /workspaceFileModelModule/u);
  assert.match(build, /workspace-image-preview\.tsx/u);
  assert.match(build, /workspaceImagePreviewModule/u);
  for (const name of [
    'workspaceFileFromResponse',
    'workspaceReloadOperation',
    'workspaceFileAfterReload',
    'workspaceImagePreviewElement',
  ]) {
    assert.doesNotMatch(legacy, new RegExp(`function ${name}\\(`, 'u'));
  }
});
