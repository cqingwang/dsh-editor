import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const dialogSource = read('src/client/components/commit/rollback-confirmation.ts');
const sessionSource = read('src/client/components/commit/use-rollback-diff-session.ts');
const diffSource = read('src/client/components/diff/DiffPreview.tsx');
const editorDiffSource = read('src/client/components/editor/EditorDiffArea.tsx');
const workspaceSource = read('src/client/editor-workspace.tsx');
const localeSource = read('src/client/locales.ts');

test('Rollback dialog restores the previous inclusion and deleteAdded state', () => {
  assert.match(dialogSource, /initial\.selectedKeys === undefined/u);
  assert.match(dialogSource, /initial\.deleteAdded === true/u);
  assert.match(dialogSource, /selectedEntries: entries\.filter/u);
  assert.match(dialogSource, /deleteAdded: deleteAddedCheckbox\.checked/u);
});

test('Rollback diff exposes IDEA Include in rollback and resumes the dialog', () => {
  assert.match(sessionSource, /selectedKeys: new Set\(next\.selectedKeys\)/u);
  assert.match(sessionSource, /resume,/u);
  assert.match(sessionSource, /selectedKey: rollbackDialogEntryKey\(decision\.entry\)/u);
  assert.match(sessionSource, /scrollTop: decision\.scrollTop/u);
  assert.match(diffSource, /rollbackInclusion\?: \{ included: boolean; onToggle: \(included: boolean\) => void \}/u);
  assert.match(diffSource, /checked=\{rollbackInclusion\.included\}/u);
  assert.match(diffSource, /rollbackInclusion\.onToggle\(event\.target\.checked\)/u);
  assert.match(editorDiffSource, /rollbackInclusion=\{rollbackInclusion\}/u);
  assert.match(workspaceSource, /rollbackInclusion=\{rollbackDiff\.inclusion\}/u);
  assert.match(workspaceSource, /const rollbackSession = rollbackDiff\.take\(\);/u);
  assert.match(workspaceSource, /resumeRollbackDiffSession\(rollbackSession\)/u);
  assert.match(workspaceSource, /beginRollbackDiffSession\(rollbackDiff\.begin, decision/u);
});

test('Rollback dialog restores the row that was last shown in the diff', () => {
  const keyCode = transpileTypeScriptFunction(dialogSource, 'rollbackDialogEntryKey');
  const indexCode = transpileTypeScriptFunction(dialogSource, 'rollbackDialogInitialIndex');
  const initialIndex = new Function(`${keyCode}\n${indexCode}\nreturn rollbackDialogInitialIndex;`)();
  const entries = [
    { path: 'src/a.ts', group: 'staged' },
    { path: 'src/b.ts', group: 'unstaged' },
  ];
  assert.equal(initialIndex(entries, 'unstaged:src/b.ts'), 1);
  assert.equal(initialIndex(entries, 'missing'), 0);
  assert.match(dialogSource, /rollbackDialogInitialIndex\(entries, initial\.selectedKey\)/u);
  assert.match(dialogSource, /selectRow\(selectedIndex, false\);/u);
  assert.match(dialogSource, /list\.scrollTop = Math\.max\(0, Number\(initial\.scrollTop\) \|\| 0\);/u);
});

test('Include in rollback is localized in both dictionaries', () => {
  assert.match(localeSource, /diffIncludeInRollback: '包含到回滚'/u);
  assert.match(localeSource, /diffIncludeInRollback: 'Include in rollback'/u);
});
