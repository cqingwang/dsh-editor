import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/project/project-options-menu.ts');
const { projectOptionsMenu, projectOptionsMenuItems } = loadTypeScriptModule(source, [
  'projectOptionsMenu',
  'projectOptionsMenuItems',
]);
const t = (key) => key;

function childById(menu, id) {
  for (const item of menu.items) {
    if (item?.id === id) return item;
    const child = item?.items?.find((entry) => entry?.id === id);
    if (child !== undefined) return child;
  }
  return null;
}

test('Project header actions do not duplicate Project tree creation', () => {
  const items = projectOptionsMenuItems({
    t,
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
  assert.equal(childById({ items }, 'newFile'), null);
  assert.equal(childById({ items }, 'newFolder'), null);
});

test('Project options menu preserves toggles, sort state and disabled actions', () => {
  const calls = [];
  const menu = projectOptionsMenu({
    t,
    position: { x: 8, y: 64 },
    previewTabEnabled: true,
    singleClickOpen: false,
    openDirectoriesSingleClick: true,
    showExcludedFiles: false,
    compactDirectories: true,
    showHidden: true,
    sortMode: 'modified-asc',
    manualOrderEmpty: true,
    foldersFirst: false,
    onRefresh: () => calls.push('refresh'),
    onGotoFile: () => calls.push('gotoFile'),
    onRecentFiles: () => calls.push('recent'),
    onTogglePreviewTab: () => calls.push('previewTab'),
    onToggleSingleClickOpen: () => calls.push('singleClickOpen'),
    onToggleOpenDirectoriesSingleClick: () => calls.push('openDirectoriesSingleClick'),
    onToggleShowExcludedFiles: () => calls.push('showExcludedFiles'),
    onToggleCompactDirectories: () => calls.push('compactDirectories'),
    onToggleHidden: () => calls.push('hidden'),
    onApplySortMode: (mode) => calls.push(`sort:${mode}`),
    onResetManualOrder: () => calls.push('resetManualOrder'),
    onToggleFoldersFirst: () => calls.push('foldersFirst'),
  });

  assert.equal(menu.owner, 'project-options');
  assert.equal(menu.x, 8);
  assert.equal(menu.y, 64);
  assert.equal(childById(menu, 'expandAll'), null);
  assert.equal(childById(menu, 'previewTab')?.shortcut, '✓');
  assert.equal(childById(menu, 'singleClickOpen')?.shortcut, '');
  assert.equal(childById(menu, 'openDirectoriesSingleClick')?.shortcut, '✓');
  assert.equal(childById(menu, 'compactDirectories')?.shortcut, '✓');
  assert.equal(childById(menu, 'hidden')?.shortcut, '✓');
  assert.equal(childById(menu, 'sort:modified-asc')?.shortcut, '✓');
  assert.equal(childById(menu, 'resetManualOrder')?.disabled, true);
  assert.equal(childById(menu, 'foldersFirst')?.shortcut, '');
  assert.equal(childById(menu, 'previewTab')?.active, true);
  assert.equal(childById(menu, 'singleClickOpen')?.active, false);
  assert.equal(childById(menu, 'openDirectoriesSingleClick')?.active, true);
  assert.equal(childById(menu, 'showExcludedFiles')?.active, false);
  assert.equal(childById(menu, 'compactDirectories')?.active, true);
  assert.equal(childById(menu, 'hidden')?.active, true);
  assert.equal(childById(menu, 'sort:name')?.active, false);
  assert.equal(childById(menu, 'sort:modified-asc')?.active, true);
  assert.equal(childById(menu, 'foldersFirst')?.active, false);

  for (const id of [
    'refresh',
    'gotoFile',
    'recent',
    'previewTab',
    'singleClickOpen',
    'openDirectoriesSingleClick',
    'showExcludedFiles',
    'compactDirectories',
    'hidden',
    'resetManualOrder',
    'foldersFirst',
  ]) {
    childById(menu, id).run();
  }
  childById(menu, 'sort:manual').run();
  assert.deepEqual(calls, [
    'refresh',
    'gotoFile',
    'recent',
    'previewTab',
    'singleClickOpen',
    'openDirectoriesSingleClick',
    'showExcludedFiles',
    'compactDirectories',
    'hidden',
    'resetManualOrder',
    'foldersFirst',
    'sort:manual',
  ]);
});

test('editor workspace reuses the extracted Project menu model', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(workspace, /import \{ projectOptionsMenuItems \} from '\.\/components\/project\/project-options-menu';/u);
  assert.match(workspace, /projectOptionsMenuItems\(\{/u);
  assert.doesNotMatch(workspace, /onOpenCreateMenu=|onOpenOptions=/u);
  assert.match(build, /project-options-menu\.ts/u);
  assert.match(client, /function projectOptionsMenuItems\(/u);
  assert.match(client, /function projectOptionsMenu\(/u);
  assert.doesNotMatch(client, /function projectToolbarMenu\(|function projectCreateMenu\(/u);
});
