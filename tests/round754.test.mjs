import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('image preview panes can become the focused editor group', () => {
  const start = client.indexOf('function ImagePreviewPane(');
  const end = client.indexOf('function workspaceFileFromResponse(', start);
  const pane = client.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(pane, /tabIndex: 0/u);
  assert.match(pane, /onFocus: \(\) => onActivate\?\.\(\)/u);
  assert.match(pane, /onPointerDown: \(\) => onActivate\?\.\(\)/u);
  assert.match(pane, /className: 'dsh-editor-image-preview'/u);
  assert.match(client, /const activateImagePane = React\.useCallback/u);
  assert.match(client, /focusedPathRef\.current = path/u);
  assert.match(client, /setFocusedPath\(path\)/u);
});

test('both editor image surfaces pass their owning path to focus activation', () => {
  assert.match(client, /workspaceImagePreviewElement\(t, activePath, activeFile, activateImagePane\)/u);
  assert.match(client, /workspaceImagePreviewElement\(t, splitPath, splitFile, activateImagePane\)/u);
  assert.match(client, /\.dsh-editor-image-preview:focus-visible/u);
});
