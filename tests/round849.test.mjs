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

test('build embeds EditorWorkspaceBody and keeps pane order in the workspace', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-workspace-body.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorWorkspaceBody\.tsx/u);
  assert.match(build, /editorWorkspaceBodyModule/u);
  assert.match(workspace, /<EditorWorkspaceBody/u);
  assert.match(workspace, /<ActivityStripe/u);
  assert.match(workspace, /<EditorToolWindowResizer/u);
  assert.match(workspace, /<EditorWorkspaceMainColumn/u);
  assert.match(fixture, /EDITOR_WORKSPACE_BODY_END/u);
  assert.match(client, /function EditorWorkspaceBody\(/u);
  assert.match(client, /React\.createElement\(\s*EditorWorkspaceBody,\s*null,/u);
});
