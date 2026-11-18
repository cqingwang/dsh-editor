import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('DiffPreview is a reusable TSX diff component', async () => {
  const component = await read('src/client/components/diff/DiffPreview.tsx');

  assert.match(component, /export interface DiffPreviewProps/u);
  assert.match(component, /<DiffViewModeControl/u);
  assert.match(component, /<PathLabel/u);
  assert.match(component, /<ToolbarButton/u);
  assert.match(component, /<ContextMenu/u);
  assert.match(component, /data-dsh-editor-diff-surface=''/u);
  assert.match(component, /React\.useEffect/u);
  assert.match(component, /monaco\.editor\.createDiffEditor/u);
  assert.match(component, /revertRangeMappings/u);
  assert.match(component, /applyChunk/u);
  assert.match(component, /restoreUndoRef/u);
  assert.match(component, /restoreRedoRef/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('DiffPreview legacy oracle is frozen and retired from live source', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/diff.ts');
  const fixture = await read('tests/fixtures/diff-preview.legacy.js');

  assert.match(build, /DiffPreview\.tsx/u);
  assert.match(build, /diffPreviewModule/u);
  assert.doesNotMatch(legacy, /function DiffPreview\(/u);
  assert.match(fixture, /function DiffPreview\(/u);
  assert.match(fixture, /\* Commit tool window: grouped/u);
});
