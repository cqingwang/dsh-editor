import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorStatusFacts is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorStatusFacts.tsx');

  assert.match(component, /export interface EditorStatusFactsProps/u);
  assert.match(component, /file\?\.kind === 'image'/u);
  assert.match(component, /t\('editor\.imagePreview'\)/u);
  assert.match(component, /t\('editor\.statusBarPosition', \{ line: caret\.line, column: caret\.column \}\)/u);
  assert.match(component, /fileMode\.encoding/u);
  assert.match(component, /t\('editor\.lineCount', \{ count: lineStats\.lines \}\)/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorStatusFacts once and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/editor-core.ts');

  assert.match(build, /EditorStatusFacts\.tsx/u);
  assert.match(build, /editorStatusFactsModule/u);
  assert.doesNotMatch(legacy, /function EditorStatusFacts\(/u);
});
