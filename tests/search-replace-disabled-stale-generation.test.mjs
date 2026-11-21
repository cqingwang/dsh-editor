import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const windowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const { findReplaceDisabledReasons, findToolResultsAreCurrent } = loadTypeScriptModule(findToolSource, [
  'findReplaceDisabledReasons',
  'findToolResultsAreCurrent',
]);
const t = (key) => key;

test('Find results are current only when the loaded generation owns the request', () => {
  assert.equal(findToolResultsAreCurrent({ searchGeneration: 5, loadedGeneration: 5 }), true);
  assert.equal(findToolResultsAreCurrent({ searchGeneration: 5, loadedGeneration: 4 }), false);
  assert.equal(findToolResultsAreCurrent({ searchGeneration: 5 }), false);
});

test('stale retained Find rows explain that the new generation is still loading', () => {
  const reasons = findReplaceDisabledReasons({
    searchGeneration: 5,
    loadedGeneration: 4,
    matchCount: 3,
    activeKind: 'text',
    t,
  });
  assert.deepEqual(reasons, {
    all: 'editor.findReplaceLoading',
    current: 'editor.findReplaceLoading',
  });
});

test('Find UI and both replace entry points share the generation guard', () => {
  assert.match(windowSource, /!findToolResultsAreCurrent\(state\)/u);
  assert.match(editorSource, /if \(!findToolResultsAreCurrent\(findTool\)\) return;/gu);
  assert.equal((editorSource.match(/if \(!findToolResultsAreCurrent\(findTool\)\) return;/gu) ?? []).length, 2);
});
