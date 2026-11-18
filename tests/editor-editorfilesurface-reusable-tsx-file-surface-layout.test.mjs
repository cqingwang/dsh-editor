import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorFileSurface is a reusable TSX file-surface layout', async () => {
  const component = await read('src/client/components/editor/EditorFileSurface.tsx');

  assert.match(component, /export interface EditorFileSurfaceProps/u);
  assert.match(component, /function EditorFileSurface\(/u);
  assert.match(component, /empty \? <div style=\{styles\.empty\}>\{emptyLabel\}<\/div> : null/u);
  assert.match(component, /display: visible \? 'flex' : 'none'/u);
  assert.match(component, /data-dsh-editor-file-surface=''/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ EditorFileSurface \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
