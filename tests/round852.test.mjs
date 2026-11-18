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

test('build embeds EditorWorkspaceMainColumn and workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-workspace-main-column.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorWorkspaceMainColumn\.tsx/u);
  assert.match(build, /editorWorkspaceMainColumnModule/u);
  assert.match(workspace, /<EditorWorkspaceMainColumn/u);
  assert.match(workspace, /<EditorTabStrip/u);
  assert.match(workspace, /<EditorFileSurface/u);
  assert.match(fixture, /EDITOR_WORKSPACE_MAIN_COLUMN_END/u);
  assert.match(client, /function EditorWorkspaceMainColumn\(/u);
});
