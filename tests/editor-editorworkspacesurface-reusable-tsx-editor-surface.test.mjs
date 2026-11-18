import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorWorkspaceSurface is a reusable TSX editor surface', async () => {
  const component = await read('src/client/components/editor/EditorWorkspaceSurface.tsx');

  assert.match(component, /export interface EditorWorkspaceSurfaceProps/u);
  assert.match(component, /function EditorWorkspaceSurface\(/u);
  assert.match(component, /<div style=\{styles\.editorSurface\}>\{children\}<\/div>/u);
  assert.match(component, /export \{ EditorWorkspaceSurface \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
