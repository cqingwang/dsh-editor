import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorWorkspaceBody is a reusable TSX layout container', async () => {
  const component = await read('src/client/components/editor/EditorWorkspaceBody.tsx');

  assert.match(component, /export interface EditorWorkspaceBodyProps/u);
  assert.match(component, /function EditorWorkspaceBody\(/u);
  assert.match(component, /<div style=\{styles\.body\}>\{children\}<\/div>/u);
  assert.match(component, /export \{ EditorWorkspaceBody \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
