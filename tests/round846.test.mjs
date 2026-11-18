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

test('build embeds EditorFileSurface and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-file-surface.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorFileSurface\.tsx/u);
  assert.match(build, /editorFileSurfaceModule/u);
  assert.match(workspace, /<EditorFileSurface/u);
  assert.match(workspace, /<EditorFileSurface[\s\S]*?visible=\{fileSurfaceVisible\}/u);
  assert.match(
    workspace,
    /<EditorFileSurface[\s\S]*?empty=\{\s*activeFile === null\s*&&\s*splitFile === null/u,
  );
  assert.match(workspace, /<EditorFileSurface[\s\S]*?emptyLabel=\{t\('editor\.noFile'\)\}/u);
  assert.match(fixture, /EDITOR_FILE_SURFACE_END/u);
  assert.match(client, /function EditorFileSurface\(/u);
  assert.match(client, /React\.createElement\(\s*EditorFileSurface,\s*\{/u);
});
