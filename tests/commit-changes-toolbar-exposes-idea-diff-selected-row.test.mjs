import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('export { CommitPanel };'));
}

test('the Changes toolbar exposes IDEA Show Diff for the selected row', () => {
  const panel = commitPanel();
  /* Round 178 moved the strip behind CompactActionBar so a narrow Changes pane
     overflows instead of laying actions beyond its right edge. */
  assert.match(panel, /<CompactActionBar/);
  assert.match(panel, /ariaLabel=\{t\('editor\.changesActions'\)\}/);
  assert.match(panel, /label: t\('editor\.showDiff'\),\s+disabled: selectedChange === null,/u);
  assert.match(panel, /if \(selectedChange !== null\) onShowDiff\?\.\(selectedChange\);/);
  assert.match(panel, /active:\s+diffTarget !== null[\s\S]*?diffTarget\.path === selectedChange\.path/u);
  assert.match(panel, /onShowDiff,\n\s+onShowCombinedDiff,\n\s+onRollbackSelected,/);
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
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(diff, /left: target\.commit\.slice\(0, 7\),\s+right: t\('editor\.commitVersion'\)/u);
  assert.match(diff, /left: target\.revision\.slice\(0, 7\),\s+right: t\('editor\.currentVersion'\)/u);
  assert.match(diff, /left: t\('editor\.clipboardVersion'\),\s+right: t\('editor\.currentVersion'\)/u);
  assert.match(source, /commitVersion: '提交版本'/);
  assert.match(source, /clipboardVersion: '剪贴板'/);
  assert.match(source, /commitVersion: 'Commit version'/);
  assert.match(source, /clipboardVersion: 'Clipboard'/);
});
