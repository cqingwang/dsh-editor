import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const menu = await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8');
const searchEverywhere = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const findTool = await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8');
const editorFind = await readFile(
  new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url),
  'utf8',
);

test('ContextMenu exposes an Escape-only focus target without changing outside-click behavior', () => {
  assert.match(menu, /escapeFocus\?: \(\) => void/u);
  assert.match(menu, /const escapeFocus = menu\.escapeFocus/u);
  assert.match(menu, /onClose\(\);\s+window\.setTimeout\(\(\) => escapeFocus\?\.\(\), 0\);/u);
});

test('Search Everywhere history menus return Escape focus to their owning fields', () => {
  assert.match(
    searchEverywhere,
    /fallbackFocus: \(\) => searchInputRef\.current\?\.focus\?\.\(\),\s+escapeFocus: \(\) => searchInputRef\.current\?\.focus\?\.\(\),/u,
  );
  assert.match(
    searchEverywhere,
    /fallbackFocus: \(\) => searchInputRef\.current\?\.focus\?\.\(\),\s+escapeFocus: \(\) => \(replaceInputRef\.current \?\? searchInputRef\.current\)\?\.focus\?\.\(\),/u,
  );
});

test('Find tool history menus focus query or replacement according to their kind', () => {
  assert.match(
    findTool,
    /escapeFocus:\s+kind === 'query'\s+\? \(\) => queryInputRef\.current\?\.focus\?\.\(\)\s+: \(\) => \(replaceInputRef\.current \?\? queryInputRef\.current\)\?\.focus\?\.\(\),/u,
  );
});

test('editor Find history menus focus their matching input refs', () => {
  assert.match(editorFind, /const findInputRef = React\.useRef<HTMLInputElement \| null>\(null\)/u);
  assert.match(editorFind, /const replaceInputRef = React\.useRef<HTMLInputElement \| null>\(null\)/u);
  assert.match(editorFind, /ref=\{findInputRef\}/u);
  assert.match(editorFind, /ref=\{replaceInputRef\}/u);
  assert.match(
    editorFind,
    /escapeFocus:\s+\(\) =>\s+\(historyMenu\.kind === 'query' \? findInputRef\.current : replaceInputRef\.current\)\?\.focus\?\.\(\),/u,
  );
});
