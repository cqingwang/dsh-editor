import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorFindBar is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorFindBar.tsx');

  assert.match(component, /export interface EditorFindBarProps/u);
  assert.match(component, /function EditorFindBar\(/u);
  assert.match(component, /data-dsh-editor-find-input=''/u);
  assert.match(component, /data-dsh-editor-find-replace-input=''/u);
  assert.match(component, /data-dsh-editor-find-history-menu=''/u);
  assert.match(component, /icon='preserveCase'/u);
  assert.match(component, /event\.altKey === true && event\.key === 'ArrowDown'/u);
  assert.match(component, /export \{ EditorFindBar \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorFindBar and removes the inline bar', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-find-bar.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorFindBar\.tsx/u);
  assert.match(build, /editorFindBarModule/u);
  assert.match(workspace, /<EditorFindBar/u);
  assert.doesNotMatch(workspace, /React\.createElement\(\s*'div',\s*\{ style: styles\.findBar \}/u);
  assert.match(fixture, /EDITOR_FIND_BAR_END/u);
  assert.match(client, /function EditorFindBar\(/u);
});
