import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('one callback reveals a changed row by clearing its group and ancestor folds', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const block = workspace.slice(
    workspace.indexOf('const revealChangeRow = React.useCallback('),
    workspace.indexOf('const navigateDiffFile = React.useCallback(', workspace.indexOf('const revealChangeRow = React.useCallback(')),
  );
  assert.notEqual(block.length, 0);
  assert.match(block, /changeRowGroup\(change, target\.staged\)/);
  assert.match(block, /revealCollapseKeys\(group, target\.path\)/);
  assert.match(block, /writeCollapsedGroups\(rootRef\.current, revealed\)/);
});

test('diff navigation and Group by share the reveal callback instead of copying it', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const navigate = workspace.slice(
    workspace.indexOf('const navigateDiffFile = React.useCallback('),
    workspace.indexOf('const projectName =', workspace.indexOf('const navigateDiffFile = React.useCallback(')),
  );
  assert.match(navigate, /revealChangeRow\(next\);/);
  const apply = workspace.slice(
    workspace.indexOf('const applyChangeGroupBy = React.useCallback('),
    workspace.indexOf('const changeGroupMenu = React.useCallback(', workspace.indexOf('const applyChangeGroupBy = React.useCallback(')),
  );
  assert.match(apply, /revealChangeRow\(selected\);/);
});

test('auto-selecting a filtered row expands it before moving the current row', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  const effect = panel.slice(
    panel.indexOf('React.useEffect(() => {', panel.indexOf('const filteredTargets')),
    panel.indexOf('const allSelected =', panel.indexOf('const filteredTargets')),
  );
  const revealAt = effect.indexOf('onRevealChange?.(filteredTargets[0])');
  const selectAt = effect.indexOf('onSelectChange?.({ path: filteredTargets[0].path');
  assert.ok(revealAt >= 0 && selectAt > revealAt);
  assert.match(panel, /onRevealChange,/);
  assert.match(source, /onRevealChange: \(target\) => revealChangeRow\(target\)/);
});
