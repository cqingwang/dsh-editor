import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8'))
);

test('the whole Diff surface is identifiable as its own keyboard domain', () => {
  assert.match(
    source,
    /ref=\{hostRef\}[\s\S]{0,180}data-dsh-editor-diff-surface=''/,
  );
});

test('Cmd/Ctrl+F opens Search In Changes from the whole Diff surface', () => {
  const start = source.indexOf('const onKeyDown = (event', source.indexOf("/* F7 / ⇧F7 are IDEA's"));
  const handler = source.slice(start, source.indexOf("window.addEventListener('keydown', onKeyDown, true);", start));
  assert.match(handler, /const insideDiffSurface = shortcutTarget\?\.closest\('\[data-dsh-editor-diff-surface\]'\) !== null/);
  assert.match(
    handler,
    /if \(meta && !event\.altKey && !event\.shiftKey && event\.key\.toLowerCase\(\) === 'f'\) \{[\s\S]*?if \(!insideDiffSurface\) return;[\s\S]*?searchInChanges\(\);/,
  );
});

test('the editor-wide search family yields to the Diff surface', () => {
  const start = source.indexOf("/* IDEA's editor search family:");
  const end = source.indexOf('const closeSearchEverywhere = React.useCallback', start);
  const family = source.slice(start, end);
  assert.match(family, /closest\('\[data-dsh-editor-diff-surface\]'\)/);
  assert.match(family, /if \(document\.activeElement\?\.closest\('\[data-dsh-editor-diff-surface\]'\) != null\) return;/);
});

test('Find step alternatives do not steal F3 from the Diff surface', () => {
  const start = source.indexOf('const findStepDirection = ideaFindStepShortcutAction');
  const end = source.indexOf('const key = event.key.toLowerCase()', start);
  const listener = source.slice(start, end);
  assert.match(listener, /\[data-dsh-editor-diff-surface\]/);
});

test('Search In Changes keeps its IDEA shortcut and existing runner', () => {
  const action = source.slice(source.indexOf("id: 'searchInChanges'"), source.indexOf("id: 'findInFiles'"));
  assert.match(action, /shortcut: '⌘F'/);
  assert.match(action, /diffSearchInChangesRef\.current\?\.\(\)/);
});
