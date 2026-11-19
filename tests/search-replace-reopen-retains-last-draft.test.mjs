import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const findTool = await read('src/client/find-tool.ts');
const workspace = await read('src/client/editor-workspace.tsx');
const { findToolReopenDraft } = loadTypeScriptModule(findTool, ['findToolReopenDraft']);
const draft = {
  query: 'zzzz-no-match-769',
  replace: 'replacement-text-769',
};

test('a direct Find/Replace shortcut can restore the last draft', () => {
  assert.deepEqual(findToolReopenDraft(draft, '', 'replace', true), draft);
  assert.deepEqual(findToolReopenDraft(draft, '', 'find', true), {
    query: 'zzzz-no-match-769',
    replace: '',
  });
});

test('an explicit query overrides only the saved query', () => {
  assert.deepEqual(findToolReopenDraft(draft, 'selected-text', 'replace', true), {
    query: 'selected-text',
    replace: 'replacement-text-769',
  });
});

test('explicit blank entry points keep their existing empty replacement', () => {
  assert.deepEqual(findToolReopenDraft(draft, '', 'replace', false), {
    query: '',
    replace: '',
  });
  assert.deepEqual(findToolReopenDraft(null, '', 'replace', true), {
    query: '',
    replace: '',
  });
});

test('Editor direct shortcuts restore draft while Actions remain blank', () => {
  assert.match(workspace, /const findToolDraftRef = React\.useRef<FindToolDraft>\(\{ query: '', replace: '' \}\)/u);
  assert.match(
    workspace,
    /const draft = findToolReopenDraft\(findToolDraftRef\.current, textQuery, mode, initial === null && restoreDraft\);/u,
  );
  assert.match(workspace, /openFindTool\(selectedQuery, 'find', null, 'query', 'popup', true\)/u);
  assert.match(workspace, /openFindTool\(selectedQuery, 'replace', null, 'query', 'popup', true\)/u);
  assert.match(workspace, /run: \(\) => openFindTool\('', 'replace'\),/u);
});
