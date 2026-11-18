import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorDiffArea is a reusable TSX diff surface', async () => {
  const component = await read('src/client/components/editor/EditorDiffArea.tsx');

  assert.match(component, /export interface EditorDiffAreaProps/u);
  assert.match(component, /function EditorDiffArea\(/u);
  assert.match(component, /if \(!active \|\| target === null\) return null;/u);
  assert.match(component, /target\?\.repositoryVersion !== null && typeof target\?\.repositoryVersion === 'object'/u);
  assert.match(component, /<RepositoryVersionPreview/u);
  assert.match(component, /<DiffPreview/u);
  assert.match(component, /includedInCommit=\{includedInCommit\}/u);
  assert.match(component, /searchInChangesRef=\{searchInChangesRef\}/u);
  assert.match(component, /export \{ EditorDiffArea \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
