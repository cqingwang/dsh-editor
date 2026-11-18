import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/project/project-options-menu.ts');
const { projectCreateMenu, projectOptionsMenu } = loadTypeScriptModule(source, [
  'projectCreateMenu',
  'projectOptionsMenu',
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

test('Project create menu preserves IDEA actions and shortcuts', () => {
  const opened = [];
  const menu = projectCreateMenu({
    t,
    position: { x: 14, y: 42 },
    onStartCreate: (kind) => opened.push(kind),
  });

  assert.equal(menu.x, 14);
  assert.equal(menu.y, 42);
  assert.equal(menu.title, 'editor.newFile');
  assert.deepEqual(
    menu.items.map((item) => item?.id),
    ['newFile', 'newFolder'],
  );
  assert.equal(childById(menu, 'newFile')?.shortcut, '⌘N');
  assert.equal(childById(menu, 'newFolder')?.shortcut, '⌥⌘N');
  childById(menu, 'newFile').run();
  childById(menu, 'newFolder').run();
  assert.deepEqual(opened, ['file', 'directory']);
});

test('Project options menu preserves toggles, sort state and disabled actions', () => {
  const calls = [];
  const menu = projectOptionsMenu({
    t,
    position: { x: 8, y: 64 },
    expandAllAvailable: false,
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
    onExpandAll: () => calls.push('expandAll'),
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
  assert.equal(childById(menu, 'expandAll')?.disabled, true);
  assert.equal(childById(menu, 'previewTab')?.shortcut, '✓');
  assert.equal(childById(menu, 'singleClickOpen')?.shortcut, '');
  assert.equal(childById(menu, 'openDirectoriesSingleClick')?.shortcut, '✓');
  assert.equal(childById(menu, 'compactDirectories')?.shortcut, '✓');
  assert.equal(childById(menu, 'hidden')?.shortcut, '✓');
  assert.equal(childById(menu, 'sort:modified-asc')?.shortcut, '✓');
  assert.equal(childById(menu, 'resetManualOrder')?.disabled, true);
  assert.equal(childById(menu, 'foldersFirst')?.shortcut, '');

  for (const id of [
    'refresh',
    'gotoFile',
    'recent',
    'expandAll',
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
    'expandAll',
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

  assert.match(workspace, /import \{ projectCreateMenu, projectOptionsMenu \} from '\.\/components\/project\/project-options-menu';/u);
  assert.match(workspace, /projectCreateMenu\(\{/u);
  assert.match(workspace, /projectOptionsMenu\(\{/u);
  const createHandler = workspace.slice(
    workspace.indexOf('onOpenCreateMenu={'),
    workspace.indexOf('optionsOpen=', workspace.indexOf('onOpenCreateMenu={')),
  );
  assert.doesNotMatch(createHandler, /id: 'newFile'/u);
  assert.doesNotMatch(createHandler, /id: 'newFolder'/u);
  assert.match(build, /project-options-menu\.ts/u);
  assert.match(client, /function projectCreateMenu\(/u);
  assert.match(client, /function projectOptionsMenu\(/u);
});
