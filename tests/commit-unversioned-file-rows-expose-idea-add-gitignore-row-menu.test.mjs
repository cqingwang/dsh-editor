import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function menuSource() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('unversioned file rows expose IDEA Add to .gitignore in the row menu', () => {
  const menu = menuSource();
  assert.match(menu, /allUnversioned\s*\?\s*\[\{\s*id: 'gitignore',[\s\S]*?label: t\('editor\.addToGitignore'\),[\s\S]*?addToGitignore\(paths\)/);
  assert.match(menu, /\[compareWithClipboard, compareWithHead, compareWithRevision, copySelectedPatch, createSelectedPatch, currentCodeEditor, currentCodePath, openFile, openInTerminal, addToGitignore, resolveConflict, restage, revealPath, rollback, root, showCombinedDiff, showFileHistory, t\]/);
});

test('addToGitignore is declared before the menu that depends on it', () => {
  const callback = source.indexOf('const addToGitignore = React.useCallback(');
  const menu = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(callback, -1);
  assert.notEqual(menu, -1);
  assert.ok(callback < menu, 'a callback dependency cannot be declared later');
});
