import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const workspaceSource = read('src/client/editor-workspace.tsx');
const preferenceSource = read('src/client/components/commit/use-commit-selection-preference.ts');
const menuSource = read('src/client/components/commit/commit-options-menu.ts');
const panelSource = read('src/client/components/commit/CommitPanel.tsx');
const localeSource = read('src/client/locales.ts');

test('Commit defaults to IDEA no-selection unless the workspace preference is enabled', () => {
  assert.match(preferenceSource, /const \[selectAllByDefault, setSelectAllByDefault\] = React\.useState\(false\)/u);
  assert.match(preferenceSource, /dsh-editor\.commit\.selectAllByDefault:\$\{root\}/u);
  assert.match(workspaceSource, /useCommitSelectionPreference\(\{/u);
  assert.match(
    workspaceSource,
    /return selectAllByDefaultRef\.current \? new Set\(changes\.map\(\(change\) => change\.path\)\) : new Set\(\);/u,
  );
  assert.match(preferenceSource, /const toggleSelectAllByDefault = React\.useCallback\(\(\): void => \{/u);
  assert.match(
    preferenceSource,
    /setCommitSelection\(next \? new Set\(changes\.map\(\(change\) => change\.path\)\) : new Set\(\)\)/u,
  );
});

test('Commit Options exposes the workspace preference as a checked menu item', () => {
  const { commitOptionsMenu } = loadTypeScriptModule(menuSource, ['commitOptionsMenu']);
  const menu = commitOptionsMenu({
    t: (key) => key,
    position: { x: 0, y: 0 },
    fetchBusy: false,
    updateBusy: false,
    commitBusy: false,
    stageAllAvailable: true,
    selectAllByDefault: true,
    groupBy: 'directory',
    onApplyChangeGroupBy: () => {},
    onFetch: () => {},
    onUpdate: () => {},
    onApplyPatchFile: () => {},
    onApplyPatchClipboard: () => {},
    onStageAll: () => {},
    onToggleSelectAllByDefault: () => {},
    onStash: () => {},
    onShelve: () => {},
  });
  const item = menu.items.find((entry) => entry?.id === 'selectAllByDefault');
  assert.equal(item?.label, 'editor.selectAllByDefault');
  assert.equal(item?.shortcut, '✓');
  assert.equal(item?.keepOpen, true);
});

test('zero selection has truthful copy instead of claiming files are selected', () => {
  assert.match(panelSource, /selectedPaths\.size === 0\s+\? t\('editor\.noneSelected'\)/u);
  assert.match(localeSource, /noneSelected: '未选择文件'/u);
  assert.match(localeSource, /noneSelected: 'No files selected'/u);
  assert.match(localeSource, /selectAllByDefault: '默认选中所有更改'/u);
  assert.match(localeSource, /selectAllByDefault: 'Select all changes by default'/u);
});
