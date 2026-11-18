import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorSplitHeader is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorSplitHeader.tsx');

  assert.match(component, /export interface EditorSplitHeaderProps/u);
  assert.match(component, /function EditorSplitHeader\(/u);
  assert.match(component, /data-dsh-editor-split-tabs=''/u);
  assert.match(component, /data-dsh-editor-split-hidden-tabs=\{String\(hiddenCount\)\}/u);
  assert.match(component, /onClick=\{onOverflow\}/u);
  assert.match(component, /onClick=\{onCloseSplit\}/u);
  assert.match(component, /export \{ EditorSplitHeader \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorSplitHeader and the split pane reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const splitPane = await read('src/client/components/editor/EditorSplitPane.tsx');
  const fixture = await read('tests/fixtures/editor-split-header.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorSplitHeader\.tsx/u);
  assert.match(build, /editorSplitHeaderModule/u);
  assert.match(splitPane, /<EditorSplitHeader/u);
  assert.match(splitPane, /tabs\}/u);
  assert.match(fixture, /EDITOR_SPLIT_HEADER_END/u);
  assert.match(client, /function EditorSplitHeader\(/u);
});
