import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('the selection restore action advertises ⌥⌘Z and forwards it to the overflow menu', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /id: 'selection',\s+icon: 'target',\s+label: t\('editor\.diffSelectionRestore'\),\s+group: 'history',\s+shortcut: '⌥⌘Z',\s+run: restoreSelection/u,
  );
  assert.match(diff, /shortcut: action\.shortcut \?\? \(action\.active === true \? '✓' : ''\)/);
});

test('⌥⌘Z in a writable diff restores only an actionable selection', () => {
  const diff = diffPreview();
  const start = diff.indexOf('const onKeyDown = (event) => {');
  const end = diff.indexOf("window.addEventListener('keydown', onKeyDown, true);", start);
  const handler = diff.slice(start, end);
  assert.match(handler, /const meta = event\.metaKey \|\| event\.ctrlKey;/);
  assert.match(handler, /if \(meta && event\.altKey && !event\.shiftKey && event\.key\.toLowerCase\(\) === 'z'\)/);
  assert.match(handler, /if \(!insideDiffPane \|\| !actionableSelection\) return;/);
  assert.match(handler, /event\.preventDefault\(\);/);
  assert.match(handler, /event\.stopPropagation\(\);/);
  assert.match(handler, /restoreSelection\(\);/);
});

test('the diff keyboard effect tracks the actionable selection state', () => {
  const diff = diffPreview();
  assert.match(
    diff,
    /\},\s+\[\s+actionableSelection,\s+applyLeftSide,\s+editLocked,\s+focusOppositeDiffPane,\s+localPathAvailable,\s+navigationPosition,\s+nextFileAction,\s+onClose,\s+onOpenLocal,\s+previousFileAction,\s+redoRestore,\s+restoreSelection,\s+searchInChanges,\s+target,\s+toggleCombinedFileCollapse,\s+undoRestore,\s+walkHunk,\s+\]\);/u,
  );
});

test('actionableSelection is initialized before the keyboard effect reads it', () => {
  const diff = diffPreview();
  const declaration = diff.indexOf('const actionableSelection =');
  const dependency = diff.search(
    /\},\s+\[\s+actionableSelection,\s+applyLeftSide,\s+editLocked,\s+focusOppositeDiffPane,\s+localPathAvailable,\s+navigationPosition,\s+nextFileAction,\s+onClose,\s+onOpenLocal,\s+previousFileAction,\s+redoRestore,\s+restoreSelection,\s+searchInChanges,\s+target,\s+toggleCombinedFileCollapse,\s+undoRestore,\s+walkHunk,\s+\]\);/u,
  );
  assert.notEqual(declaration, -1);
  assert.notEqual(dependency, -1);
  assert.ok(declaration < dependency, 'a hook dependency cannot reference a later const in its TDZ');
});
