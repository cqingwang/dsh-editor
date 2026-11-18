import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('Show Diff moves keyboard focus into the comparison', () => {
  const diff = diffPreview();
  assert.match(diff, /const focusDiffRef = React\.useRef\(null\)/);
  const focusStart = diff.indexOf('focusDiffRef.current = () => {');
  const focus = diff.slice(focusStart, diff.indexOf('React.useEffect', focusStart));
  assert.match(focus, /getModifiedEditor\?\.\(\)/);
  assert.match(focus, /\.focus\(\)/);
  assert.match(diff, /void diff\.waitForDiff\(\)\.then\(\(\) => \{[\s\S]*?focusFirstHunkRef\.current\?\.\(\);[\s\S]*?focusDiffRef\.current\?\.\(\);/);
});

test('the active diff owns IDEA Close Tab and returns focus to its origin', () => {
  const diff = diffPreview();
  assert.match(diff, /event\.key\.toLowerCase\(\) === 'w'/);
  assert.match(diff, /event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?onClose\(\);/);
  assert.match(
    diff,
    /\},\s+\[\s+actionableSelection,\s+applyLeftSide,\s+editLocked,\s+focusOppositeDiffPane,\s+localPathAvailable,\s+navigationPosition,\s+nextFileAction,\s+onClose,\s+onOpenLocal,\s+previousFileAction,\s+redoRestore,\s+restoreSelection,\s+searchInChanges,\s+target,\s+toggleCombinedFileCollapse,\s+undoRestore,\s+walkHunk,\s+\]\);/u,
  );

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const diffReturnFocusRef = React\.useRef\(null\)/);
  assert.match(workspace, /const closeDiff = React\.useCallback\(\(\) => \{[\s\S]*?setDiffTarget\(null\);[\s\S]*?editorRef\.current\?\.focus\(\)/);
  assert.match(workspace, /if \(row\.isConnected\) row\.focus\(\);/);
  assert.match(workspace, /onShowDiff=\{\(target\) => \{[\s\S]*?diffReturnFocusRef\.current =\s+changeRowRefs\.current\.get/);
  assert.match(workspace, /onClose=\{closeDiff\}/);
});

test('Enter in the Changes tree also remembers the row that opened the diff', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const enter = workspace.slice(workspace.indexOf("if (event.key === 'Enter') {"), workspace.indexOf("if (event.key === ' ')"));
  assert.match(enter, /closest\('\[data-dsh-change-path\]'\)/);
  assert.match(enter, /diffReturnFocusRef\.current = focusedRow instanceof HTMLElement \? focusedRow : node/);
});
