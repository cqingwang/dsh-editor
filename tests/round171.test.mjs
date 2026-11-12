import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
}

test('the Changes toolbar exposes IDEA Show Diff for the selected row', () => {
  const panel = commitPanel();
  /* Round 178 moved the strip behind CompactActionBar so a narrow Changes pane
     overflows instead of laying actions beyond its right edge. */
  assert.match(panel, /React\.createElement\(CompactActionBar, \{/);
  assert.match(panel, /ariaLabel: t\('editor\.changesActions'\)/);
  assert.match(panel, /label: t\('editor\.showDiff'\),\n\s+disabled: selectedChange === null,/);
  assert.match(panel, /if \(selectedChange !== null\) onShowDiff\?\.\(selectedChange\);/);
  assert.match(panel, /active: diffTarget !== null[\s\S]*?diffTarget\.path === selectedChange\.path/);
  assert.match(panel, /onShowDiff,\n\s+onRollbackSelected,/);
});

test('Show Diff opens the selected change without toggling the existing diff closed', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const call = workspace.slice(workspace.indexOf('React.createElement(CommitPanel'), workspace.indexOf('onStage: (paths)', workspace.indexOf('React.createElement(CommitPanel')));
  const action = call.slice(call.indexOf('onShowDiff: (target) => {'), call.indexOf('onRollbackSelected:'));
  assert.match(action, /setDiffTarget\(target\);/);
  assert.match(action, /setDiffActive\(true\);/);
  assert.doesNotMatch(action, /setDiffTarget\(\(current\)/);
  /* Round 179 moved the action-bar Rollback onto the whole Changes selection. */
  assert.match(call, /onRollbackSelected: \(picked\) => \{/);
  assert.match(call, /entry\.staged !== true/);
  assert.match(call, /void rollback\(working\)/);
});

test('read-only diff column heads name their actual sides', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /target\.commit\.slice\(0, 7\), right: t\('editor\.commitVersion'\)/);
  assert.match(diff, /target\.revision\.slice\(0, 7\), right: t\('editor\.currentVersion'\)/);
  assert.match(diff, /t\('editor\.clipboardVersion'\), right: t\('editor\.currentVersion'\)/);
  assert.match(source, /commitVersion: '提交版本'/);
  assert.match(source, /clipboardVersion: '剪贴板'/);
  assert.match(source, /commitVersion: 'Commit version'/);
  assert.match(source, /clipboardVersion: 'Clipboard'/);
});
