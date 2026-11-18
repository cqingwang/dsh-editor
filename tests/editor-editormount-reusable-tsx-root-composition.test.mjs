import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorMount is a reusable TSX root composition', async () => {
  const component = await read('src/client/components/editor/EditorMount.tsx');

  assert.match(component, /export interface EditorMountProps/u);
  assert.match(component, /function EditorMount\(/u);
  assert.match(component, /workspaceComponent: React\.ComponentType<\{[\s\S]*?\}>/u);
  assert.match(component, /<EditorErrorBoundary/u);
  assert.match(component, /<Workspace/u);
  assert.match(component, /initialHarnessCollapsed=\{initialHarnessCollapsed\}/u);
  assert.match(component, /onToggleHarness=\{onToggleHarness\}/u);
  assert.match(component, /onCloseEditor=\{onCloseEditor\}/u);
  assert.match(component, /onInsertHarnessReference=\{onInsertHarnessReference\}/u);
  assert.match(component, /export \{ EditorMount \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
