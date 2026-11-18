import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

function findToolComponent() {
  return source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
}

test('File mask enable focuses the mask input and disable returns to Search', () => {
  const component = findToolComponent();
  assert.match(
    component,
    /const enabled = event\.target\.checked;[\s\S]*?window\.setTimeout\(\(\) => \{\s+\(enabled \? fileMaskInputRef : queryInputRef\)\.current\?\.focus\?\.\(\);\s+\}, 0\);/u,
  );
});

test('File mask history selection returns focus to the mask input', () => {
  const component = findToolComponent();
  const menu = component.slice(
    component.indexOf('const openFileMaskMenu ='),
    component.indexOf('const openFilterMenu ='),
  );
  const runs = menu.match(/acceptFileMask\(value\);\s+window\.setTimeout\(\(\) => fileMaskInputRef\.current\?\.focus\?\.\(\), 0\);/gu) ?? [];
  assert.equal(runs.length, 2);
  assert.match(
    menu,
    /acceptFileMask\(''\);\s+window\.setTimeout\(\(\) => fileMaskInputRef\.current\?\.focus\?\.\(\), 0\);/u,
  );
});

test('Filter Search Results selection returns focus to Search', () => {
  const component = findToolComponent();
  const menu = component.slice(
    component.indexOf('const openFilterMenu ='),
    component.indexOf('const selectFindGroupBy ='),
  );
  assert.match(
    menu,
    /onContextFilterChange\(value\);\s+window\.setTimeout\(\(\) => queryInputRef\.current\?\.focus\?\.\(\), 0\);/u,
  );
});

test('Mouse Scope mode and preset changes return focus to Search', () => {
  const component = findToolComponent();
  assert.match(
    component,
    /onClick=\{\(\) => \{\s+selectFindScopeMode\(scope\.id\);\s+window\.setTimeout\(\(\) => queryInputRef\.current\?\.focus\?\.\(\), 0\);\s+\}\}/u,
  );
  assert.match(
    component,
    /const selectFindScopePreset = \(preset\) => \{\s+setScopePreset\(preset\);\s+emitFindScopeChange\(scopeMode, preset, scopeDirectoryDraft\);\s+window\.setTimeout\(\(\) => queryInputRef\.current\?\.focus\?\.\(\), 0\);\s+\};/u,
  );
  assert.match(
    component,
    /const moveFindScopeMode = \(mode\) => \{\s+selectFindScopeMode\(mode\);\s+window\.setTimeout\(\(\) => scopeModeButtonRefs\.current\.get\(mode\)\?\.focus\?\.\(\), 0\);\s+\};/u,
  );
});

test('Scope changes still invalidate the active request generation', () => {
  assert.match(
    source,
    /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1,\s+loadedGeneration: -1,/u,
  );
});
