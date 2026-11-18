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

test('build embeds EditorWorkspaceSurface and keeps editor chrome inside', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-workspace-surface.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorWorkspaceSurface\.tsx/u);
  assert.match(build, /editorWorkspaceSurfaceModule/u);
  assert.match(workspace, /<EditorWorkspaceSurface/u);
  assert.match(workspace, /<EditorTabStrip/u);
  assert.match(workspace, /<EditorFileSurface/u);
  assert.match(workspace, /<EditorTerminalDock/u);
  assert.match(fixture, /EDITOR_WORKSPACE_SURFACE_END/u);
  assert.match(client, /function EditorWorkspaceSurface\(/u);
});
