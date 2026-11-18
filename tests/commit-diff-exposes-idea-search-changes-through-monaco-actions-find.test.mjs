import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('Diff exposes IDEA Search In Changes through Monaco actions.find', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const searchInChanges = React.useCallback');
  assert.notEqual(start, -1);
  const body = diff.slice(start, diff.indexOf('React.useEffect', start));
  assert.match(body, /getModifiedEditor\?\.\(\)/);
  assert.match(body, /trigger\('dsh-editor', 'actions\.find', null\)/);
  assert.match(diff, /id: 'find',[\s\S]*?icon: 'search',[\s\S]*?label: t\('editor\.searchInChanges'\),[\s\S]*?shortcut: '⌘F'/);
});

test('⌘F is claimed across the Diff surface but not foreign editors', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const onKeyDown = (event) => {');
  const end = diff.indexOf("window.addEventListener('keydown', onKeyDown, true);", start);
  const handler = diff.slice(start, end);
  assert.match(handler, /if \(meta && !event\.altKey && !event\.shiftKey && event\.key\.toLowerCase\(\) === 'f'\)/);
  assert.match(handler, /const insideDiffSurface = shortcutTarget\?\.closest\('\[data-dsh-editor-diff-surface\]'\) !== null/);
  assert.match(handler, /if \(!insideDiffSurface\) return;/);
  assert.match(handler, /event\.preventDefault\(\);/);
  assert.match(handler, /searchInChanges\(\);/);
});

test('the Diff keyboard effect tracks Search In Changes', () => {
  const diff = diffPreview();
  assert.match(diff, /\}, \[actionableSelection, applyLeftSide, editLocked, focusOppositeDiffPane, localPathAvailable, navigationPosition, nextFileAction, onClose, onOpenLocal, previousFileAction, redoRestore, restoreSelection, searchInChanges, target, toggleCombinedFileCollapse, undoRestore, walkHunk\]\);/);
});
