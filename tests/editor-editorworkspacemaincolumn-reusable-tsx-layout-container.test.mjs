import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorWorkspaceMainColumn is a reusable TSX layout container', async () => {
  const component = await read('src/client/components/editor/EditorWorkspaceMainColumn.tsx');

  assert.match(component, /export interface EditorWorkspaceMainColumnProps/u);
  assert.match(component, /function EditorWorkspaceMainColumn\(/u);
  assert.match(component, /<div style=\{styles\.mainColumn\}>\{children\}<\/div>/u);
  assert.match(component, /export \{ EditorWorkspaceMainColumn \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
