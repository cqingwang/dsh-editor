import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorTabStrip is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorTabStrip.tsx');

  assert.match(component, /export interface EditorTabStripProps/u);
  assert.match(component, /function EditorTabStrip\(/u);
  assert.match(component, /data-dsh-editor-tabstrip=''/u);
  assert.match(component, /data-dsh-editor-tabstrip-trailing=''/u);
  assert.match(component, /data-dsh-hidden-tabs=\{String\(hiddenCount\)\}/u);
  assert.match(component, /<MarkdownModeSwitch/u);
  assert.match(component, /className='dsh-editor-tab-overflow'/u);
  assert.match(component, /onClick=\{onOverflow\}/u);
  assert.match(component, /export \{ EditorTabStrip \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('main file tabs reuse EditorFileTab and build embeds EditorTabStrip', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-tab-strip.legacy.js');
  const mainTabFixture = await read('tests/fixtures/editor-main-file-tab.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorTabStrip\.tsx/u);
  assert.match(build, /editorTabStripModule/u);
  assert.match(workspace, /<EditorTabStrip/u);
  assert.match(workspace, /return \(\s*<EditorFileTab/u);
  assert.match(workspace, /<EditorFileTab[\s\S]*?dataAttributeName='data-dsh-editor-file-tab-path'/u);
  assert.match(fixture, /EDITOR_TAB_STRIP_END/u);
  assert.match(mainTabFixture, /EDITOR_MAIN_FILE_TAB_END/u);
  assert.match(client, /function EditorTabStrip\(/u);
});
