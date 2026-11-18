import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('ImagePreviewPane is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/ImagePreviewPane.tsx');

  assert.match(component, /export interface ImagePreviewPaneProps/u);
  assert.match(component, /status: 'loading' \| 'loaded' \| 'error'/u);
  assert.match(component, /data-dsh-editor-image-preview=\{path\}/u);
  assert.match(component, /data-dsh-editor-image-preview-asset=''/u);
  assert.match(component, /onFocus=\{\(\) => onActivate\?\.\(\)\}/u);
  assert.match(component, /onPointerDown=\{\(\) => onActivate\?\.\(\)\}/u);
  assert.match(component, /onLoad=\{\(event\) =>/u);
  assert.match(component, /naturalWidth/u);
  assert.match(component, /naturalHeight/u);
  assert.match(component, /t\('editor\.imagePreviewFailed', \{ path \}\)/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds ImagePreviewPane once and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/editor-core.ts');

  assert.match(build, /ImagePreviewPane\.tsx/u);
  assert.match(build, /imagePreviewPaneModule/u);
  assert.doesNotMatch(legacy, /function ImagePreviewPane\(/u);
});
