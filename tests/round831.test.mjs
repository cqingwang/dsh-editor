import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorStatusBar is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorStatusBar.tsx');

  assert.match(component, /export interface EditorStatusBarProps/u);
  assert.match(component, /function EditorStatusBar\(/u);
  assert.match(component, /data-dsh-editor-status-path=''/u);
  assert.match(component, /<EditorStatusFacts/u);
  assert.match(component, /label=\{t\('editor\.gotoLine'\)\}/u);
  assert.match(component, /label=\{t\('editor\.annotate'\)\}/u);
  assert.match(component, /export \{ EditorStatusBar \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorStatusBar and removes the inline bar', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-status-bar.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorStatusBar\.tsx/u);
  assert.match(build, /editorStatusBarModule/u);
  assert.match(workspace, /<EditorStatusBar/u);
  assert.doesNotMatch(workspace, /React\.createElement\(EditorStatusFacts/u);
  assert.match(fixture, /EDITOR_STATUS_BAR_END/u);
  assert.match(client, /function EditorStatusBar\(/u);
});
