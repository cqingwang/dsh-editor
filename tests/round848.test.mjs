import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorWorkspaceShell is a reusable TSX workspace root', async () => {
  const component = await read('src/client/components/editor/EditorWorkspaceShell.tsx');

  assert.match(component, /export interface EditorWorkspaceShellProps/u);
  assert.match(component, /function EditorWorkspaceShell\(/u);
  assert.match(component, /style=\{styles\.root\}/u);
  assert.match(component, /data-dsh-editor-workspace=''/u);
  assert.match(component, /data-dsh-workspace-id=\{workspaceId \|\| undefined\}/u);
  assert.match(component, /data-dsh-editor-gutter-surface='idea'/u);
  assert.match(component, /\{\.\.\.editorFileDragProps\}/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ EditorWorkspaceShell \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorWorkspaceShell and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-workspace-shell.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorWorkspaceShell\.tsx/u);
  assert.match(build, /editorWorkspaceShellModule/u);
  assert.match(workspace, /<EditorWorkspaceShell/u);
  assert.match(
    workspace,
    /<EditorWorkspaceShell[\s\S]*?workspaceId=\{workspaceId\}[\s\S]*?editorFileDragProps=\{editorFileDragProps\}/u,
  );
  assert.match(fixture, /EDITOR_WORKSPACE_SHELL_END/u);
  assert.match(client, /function EditorWorkspaceShell\(/u);
  assert.match(client, /React\.createElement\(\s*EditorWorkspaceShell,\s*\{/u);
});
