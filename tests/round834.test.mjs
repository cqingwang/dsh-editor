import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorDiffTab is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorDiffTab.tsx');

  assert.match(component, /export interface EditorDiffTabProps/u);
  assert.match(component, /function EditorDiffTab\(/u);
  assert.match(component, /role='tab'/u);
  assert.match(component, /aria-selected=\{active\}/u);
  assert.match(component, /data-dsh-editor-diff-tab=''/u);
  assert.match(component, /name='commit'/u);
  assert.match(component, /className='dsh-editor-tab-close'/u);
  assert.match(component, /onClose\(\)/u);
  assert.match(component, /export \{ EditorDiffTab \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorDiffTab and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-diff-tab.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorDiffTab\.tsx/u);
  assert.match(build, /editorDiffTabModule/u);
  assert.match(workspace, /<EditorDiffTab/u);
  assert.match(workspace, /<EditorDiffTab[\s\S]*?key='dsh-editor-difftab'/u);
  assert.match(fixture, /EDITOR_DIFF_TAB_END/u);
  assert.match(client, /function EditorDiffTab\(/u);
});
