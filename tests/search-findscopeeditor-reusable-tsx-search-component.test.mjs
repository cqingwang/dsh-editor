import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('FindScopeEditor is a reusable TSX search component', async () => {
  const component = await read('src/client/components/search/FindScopeEditor.tsx');

  assert.match(component, /export interface FindScopeEditorProps/u);
  assert.match(component, /data-dsh-find-scope-editor/u);
  assert.match(component, /role='dialog'/u);
  assert.match(component, /findAddScope/u);
  assert.match(component, /findDeleteScope/u);
  assert.match(component, /findScopeInclude/u);
  assert.match(component, /findScopeExclude/u);
  assert.match(component, /findScopeShare/u);
  assert.match(component, /findScopeImport/u);
  assert.match(component, /findScopeExport/u);
  assert.match(component, /data-dsh-find-scope-transfer/u);
  assert.match(component, /inspectIdeaScopeXml\(value\.content\)/u);
  assert.match(component, /normalizeCustomFindScopes\(drafts\)/u);
  assert.match(component, /onSave\(normalized, selectedId\)/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
