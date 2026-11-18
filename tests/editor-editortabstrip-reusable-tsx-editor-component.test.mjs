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
