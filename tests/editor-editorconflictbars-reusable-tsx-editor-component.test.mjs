import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorConflictBars is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/EditorConflictBars.tsx');

  assert.match(component, /export interface EditorConflictBarsProps/u);
  assert.match(component, /function EditorConflictBars\(/u);
  assert.match(component, /externalChange\.missing === true/u);
  assert.match(component, /t\('editor\.externalDeleted'\)/u);
  assert.match(component, /t\('editor\.externalChanged'\)/u);
  assert.match(component, /t\('editor\.recreateFile'\)/u);
  assert.match(component, /t\('editor\.keepLocal'\)/u);
  assert.match(component, /t\('editor\.overwrite'\)/u);
  assert.match(component, /t\('editor\.reloadFromDisk'\)/u);
  assert.match(component, /export \{ EditorConflictBars \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
