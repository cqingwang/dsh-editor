import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const panel = await read('src/client/components/project/ProjectPanel.tsx');
const workspace = await read('src/client/editor-workspace.tsx');
const panelToolbar = await read('src/client/components/ui/PanelToolbar.tsx');
const menuSource = await read('src/client/components/project/project-options-menu.ts');
const { projectOptionsMenuItems } = loadTypeScriptModule(menuSource, ['projectOptionsMenuItems']);

test('Project header actions exclude redundant create entries and keep option commands', () => {
  const items = projectOptionsMenuItems({
    t: (key) => key,
    previewTabEnabled: false,
    singleClickOpen: false,
    openDirectoriesSingleClick: false,
    showExcludedFiles: false,
    compactDirectories: false,
    showHidden: false,
    sortMode: 'name',
    manualOrderEmpty: true,
    foldersFirst: true,
    onRefresh() {},
    onGotoFile() {},
    onRecentFiles() {},
    onTogglePreviewTab() {},
    onToggleSingleClickOpen() {},
    onToggleOpenDirectoriesSingleClick() {},
    onToggleShowExcludedFiles() {},
    onToggleCompactDirectories() {},
    onToggleHidden() {},
    onApplySortMode() {},
    onResetManualOrder() {},
    onToggleFoldersFirst() {},
  });
  assert.deepEqual(
    items.map((item) => item?.id ?? null),
    ['refresh', 'gotoFile', 'recent', null, 'behavior', 'appearance'],
  );
  assert.doesNotMatch(menuSource, /id: 'newFile'|id: 'newFolder'|projectCreateMenu|projectToolbarMenu/u);
});

test('the Project view arrow owns the Project action context menu', () => {
  assert.doesNotMatch(panel, /id: 'newEntry'|overflowMenuItems=/);
  assert.doesNotMatch(panel, /onOpenCreateMenu|onOpenOptions|optionsOpen/);
  assert.match(panel, /projectMenuItems: MenuEntry\[\]/u);
  assert.match(panel, /openProjectViewMenu\(event\.currentTarget, true\)/u);
  assert.match(panel, /\[\.\.\.viewItems, null, \.\.\.projectMenuItems\]/u);
  assert.doesNotMatch(panelToolbar, /overflowMenuItems=\{toolbarMenuItems\}/u);
  assert.match(workspace, /projectOptionsMenuItems\(\{/u);
  assert.doesNotMatch(workspace, /projectToolbarMenu|onStartCreate: startCreate/u);
});
