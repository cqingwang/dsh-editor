import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorSplitDivider is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorSplitDivider.tsx');

  assert.match(component, /export interface EditorSplitDividerProps/u);
  assert.match(component, /function EditorSplitDivider\(/u);
  assert.match(component, /data-dsh-editor-split-divider=''/u);
  assert.match(component, /role='separator'/u);
  assert.match(component, /aria-orientation='vertical'/u);
  assert.match(component, /aria-valuemin=\{20\}/u);
  assert.match(component, /aria-valuemax=\{80\}/u);
  assert.match(component, /aria-valuenow=\{Math\.round\(percent\)\}/u);
  assert.match(component, /clampPercent\(/u);
  assert.match(component, /onDraggingChange\(true\)/u);
  assert.match(component, /onCommit\(Math\.round\(clampPercent\(latest, rect\.width\)\)\)/u);
  assert.match(component, /export \{ EditorSplitDivider \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
