import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorMount is a reusable TSX root composition', async () => {
  const component = await read('src/client/components/editor/EditorMount.tsx');

  assert.match(component, /export interface EditorMountProps/u);
  assert.match(component, /function EditorMount\(/u);
  assert.match(component, /workspaceComponent: React\.ComponentType<any>/u);
  assert.match(component, /<EditorErrorBoundary/u);
  assert.match(component, /<Workspace/u);
  assert.match(component, /initialHarnessCollapsed=\{initialHarnessCollapsed\}/u);
  assert.match(component, /onToggleHarness=\{onToggleHarness\}/u);
  assert.match(component, /onCloseEditor=\{onCloseEditor\}/u);
  assert.match(component, /onInsertHarnessReference=\{onInsertHarnessReference\}/u);
  assert.match(component, /export \{ EditorMount \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorMount and controller reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const controller = await read('src/client/controller.ts');
  const fixture = await read('tests/fixtures/editor-mount.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorMount\.tsx/u);
  assert.match(build, /editorMountModule/u);
  assert.doesNotMatch(controller, /React\.createElement\(EditorErrorBoundary/u);
  assert.doesNotMatch(controller, /React\.createElement\(EditorWorkspace/u);
  assert.match(controller, /React\.createElement\(EditorMount, \{/u);
  assert.match(controller, /workspaceComponent: EditorWorkspace/u);
  assert.match(fixture, /EDITOR_MOUNT_END/u);
  assert.match(client, /function EditorMount\(/u);
  assert.match(client, /React\.createElement\(EditorMount, \{/u);
});
