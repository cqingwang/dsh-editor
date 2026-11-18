import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const imagePaneSource = await readFile(
  new URL('../src/client/components/editor/ImagePreviewPane.tsx', import.meta.url),
  'utf8',
);
const imagePreviewElementSource = await readFile(
  new URL('../src/client/components/editor/workspace-image-preview.tsx', import.meta.url),
  'utf8',
);

test('image preview panes can become the focused editor group', () => {
  assert.match(imagePaneSource, /tabIndex=\{0\}/u);
  assert.match(imagePaneSource, /onFocus=\{\(\) => onActivate\?\.\(\)\}/u);
  assert.match(imagePaneSource, /onPointerDown=\{\(\) => onActivate\?\.\(\)\}/u);
  assert.match(imagePaneSource, /className='dsh-editor-image-preview'/u);
  assert.match(client, /const activateImagePane = React\.useCallback/u);
  assert.match(client, /focusedPathRef\.current = path/u);
  assert.match(client, /setFocusedPath\(path\)/u);
});

test('both editor image surfaces pass their owning path to focus activation', () => {
  assert.match(imagePreviewElementSource, /function workspaceImagePreviewElement\(/u);
  assert.match(imagePreviewElementSource, /<ImagePreviewPane/u);
  assert.match(imagePreviewElementSource, /onActivate=\{\(\) => onActivate\?\.\(path\)\}/u);
  assert.match(client, /workspaceImagePreviewElement\(t, activePath, activeFile, activateImagePane\)/u);
  assert.match(client, /workspaceImagePreviewElement\(t, splitPath, splitFile, activateImagePane\)/u);
  assert.match(client, /\.dsh-editor-image-preview:focus-visible/u);
});
