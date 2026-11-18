import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorAnnotateArea is a reusable TSX annotate surface', async () => {
  const component = await read('src/client/components/editor/EditorAnnotateArea.tsx');

  assert.match(component, /export interface EditorAnnotateAreaProps/u);
  assert.match(component, /function EditorAnnotateArea\(/u);
  assert.match(component, /if \(!active \|\| target === null\) return null;/u);
  assert.match(component, /<AnnotatePreview/u);
  assert.match(component, /loading=\{loading\}/u);
  assert.match(component, /truncated=\{truncated\}/u);
  assert.match(component, /onOpenCommit=\{onOpenCommit\}/u);
  assert.match(component, /selected=\{selected\}/u);
  assert.match(component, /export \{ EditorAnnotateArea \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorAnnotateArea and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-annotate-area.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorAnnotateArea\.tsx/u);
  assert.match(build, /editorAnnotateAreaModule/u);
  assert.doesNotMatch(workspace, /React\.createElement\(AnnotatePreview, \{/u);
  assert.match(workspace, /<EditorAnnotateArea/u);
  assert.match(workspace, /<EditorAnnotateArea[\s\S]*?active=\{annotateTarget !== null\}/u);
  assert.match(workspace, /<EditorAnnotateArea[\s\S]*?onClose=\{\(\) => setAnnotateTarget\(null\)\}/u);
  assert.match(fixture, /EDITOR_ANNOTATE_AREA_END/u);
  assert.match(client, /function EditorAnnotateArea\(/u);
  assert.match(client, /React\.createElement\(EditorAnnotateArea, \{/u);
});
