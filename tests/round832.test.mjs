import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorFileTab is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorFileTab.tsx');

  assert.match(component, /export interface EditorFileTabProps/u);
  assert.match(component, /function EditorFileTab\(/u);
  assert.match(component, /role='tab'/u);
  assert.match(component, /aria-selected=\{active\}/u);
  assert.match(component, /tabIndex=\{active \? 0 : -1\}/u);
  assert.match(component, /\{\.\.\.\{ \[dataAttributeName\]: path \}\}/u);
  assert.match(component, /className='dsh-editor-tab-close'/u);
  assert.match(component, /onClose\(\)/u);
  assert.match(component, /export \{ EditorFileTab \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorFileTab and the split strip reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-file-tab.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorFileTab\.tsx/u);
  assert.match(build, /editorFileTabModule/u);
  assert.match(workspace, /return \(\s*<EditorFileTab/u);
  assert.match(workspace, /<EditorFileTab[\s\S]*?dataAttributeName='data-dsh-editor-split-path'/u);
  assert.match(fixture, /EDITOR_FILE_TAB_END/u);
  assert.match(client, /function EditorFileTab\(/u);
});
