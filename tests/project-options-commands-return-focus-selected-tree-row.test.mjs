import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectOptions = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const commitPanel = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const diffPreview = readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8');

test('Project Options commands return focus to the selected tree row', () => {
  assert.match(workspace, /const focusProjectAfterOption = React\.useCallback\(\(\) => \{/);
  assert.match(workspace, /const target =\s+row\?\.isConnected === true && row\.tabIndex >= 0 \? row : treeRef\.current;/u);
  assert.match(workspace, /const runProjectOption = React\.useCallback\(/);
  assert.match(workspace, /window\.setTimeout\(focusNow, 120\)/);
  for (const id of ['refresh', 'expandAll']) {
    const start = projectOptions.indexOf(`id: '${id}'`);
    assert.notEqual(start, -1, `${id} is missing`);
    const row = projectOptions.slice(start, start + 300);
    assert.match(row, /restoreFocus: false/, `${id} must suppress the opener restore`);
  }
  assert.match(workspace, /onToggleSingleClickOpen: \(\) => runProjectOption\(\(\) => toggleSingleClickOpen\(\)\)/);
  assert.match(
    workspace,
    /onToggleOpenDirectoriesSingleClick: \(\) =>\s+runProjectOption\(\(\) => toggleOpenDirectoriesSingleClick\(\)\)/u,
  );
  assert.match(workspace, /onApplySortMode: \(mode\) => runProjectOption\(\(\) => applySortMode\(mode\)\)/);
  assert.match(workspace, /onRefresh: \(\) => runProjectOption\(\(\) => void refreshTree\(\)\)/);
  assert.match(workspace, /onExpandAll: \(\) => runProjectOption\(\(\) => void expandAll\(\)\)/);
  assert.match(projectOptions, /id: 'singleClickOpen'[\s\S]*?restoreFocus: false/u);
  assert.match(projectOptions, /id: 'openDirectoriesSingleClick'[\s\S]*?restoreFocus: false/u);
  assert.match(projectOptions, /id: 'appearance'[\s\S]*?id: 'hidden'[\s\S]*?restoreFocus: false/u);
  assert.match(menuSource, /const skipReturnFocusRef = React\.useRef\(false\);/);
  assert.match(
    menuSource,
    /if \(item\.keepOpen !== true && item\.restoreFocus === false\) skipReturnFocusRef\.current = true;/,
  );
  assert.match(menuSource, /if \(skipReturnFocusRef\.current\) return;/);
});

test('palette-opening Project Options keep their own focus target', () => {
  const optionsCall = workspace.slice(
    workspace.indexOf('projectOptionsMenu({'),
    workspace.indexOf('onCreateChange={(value) =>', workspace.indexOf('projectOptionsMenu({')),
  );
  const gotoFile = optionsCall.slice(optionsCall.indexOf('onGotoFile:'), optionsCall.indexOf('onRecentFiles:'));
  const recent = optionsCall.slice(optionsCall.indexOf('onRecentFiles:'), optionsCall.indexOf('onExpandAll:'));
  assert.match(gotoFile, /onGotoFile: \(\) => void openQuickOpen\(\)/);
  assert.match(recent, /onRecentFiles: openRecent/);
  assert.doesNotMatch(gotoFile, /runProjectOption/);
  assert.doesNotMatch(recent, /runProjectOption/);
});

test('folding unchanged diff regions cannot reset the hunk counter', () => {
  const effectStart = diffPreview.lastIndexOf('hideUnchangedRegions: {');
  assert.notEqual(effectStart, -1);
  const effectEnd = diffPreview.indexOf('}, [collapseUnchanged]);', effectStart);
  assert.notEqual(effectEnd, -1);
  const effect = diffPreview.slice(Math.max(0, effectStart - 300), effectEnd);
  assert.match(effect, /minimumLineCount: 4/);
  assert.doesNotMatch(effect, /setHunks\(/);
  assert.doesNotMatch(effect, /setDiffTarget\(/);
});

test('Commit toolbar keeps its trailing refresh/hide actions in the right group', () => {
  const start = commitPanel.indexOf('<PanelToolbar', commitPanel.indexOf('function CommitPanel('));
  assert.notEqual(start, -1);
  const end = commitPanel.indexOf('historyMenu === null', start);
  assert.notEqual(end, -1);
  const toolbar = commitPanel.slice(start, end);
  const refresh = toolbar.indexOf("id: 'refresh'");
  const hide = toolbar.indexOf("id: 'hide'");
  assert.ok(refresh >= 0 && hide > refresh, 'refresh then hide must be the trailing actions');
});
