import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/commit-options-menu.ts');
const { changeGroupMenu, changesViewOptionsMenu, commitOptionsMenu } = loadTypeScriptModule(source, [
  'changeGroupMenu',
  'changesViewOptionsMenu',
  'commitOptionsMenu',
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

test('Change Group By menu preserves all modes and current check mark', () => {
  const applied = [];
  const menu = changeGroupMenu({
    t,
    position: { x: 20, y: 40 },
    groupBy: 'module',
    onApplyChangeGroupBy: (mode) => applied.push(mode),
  });

  assert.equal(menu.title, 'editor.groupByMenu');
  assert.deepEqual(
    menu.items.map((item) => item?.id),
    ['groupBy:flat', 'groupBy:module', 'groupBy:directory'],
  );
  assert.equal(childById(menu, 'groupBy:flat')?.shortcut, '');
  assert.equal(childById(menu, 'groupBy:module')?.shortcut, '✓');
  assert.equal(childById(menu, 'groupBy:directory')?.shortcut, '');
  childById(menu, 'groupBy:flat').run();
  childById(menu, 'groupBy:directory').run();
  assert.deepEqual(applied, ['flat', 'directory']);
});

test('Changes View Options reuses the Group By value menu', () => {
  const menu = changesViewOptionsMenu({
    t,
    position: { x: 32, y: 52 },
    groupBy: 'directory',
    onApplyChangeGroupBy: () => {},
  });

  assert.equal(menu.owner, 'changes-view-options');
  assert.equal(menu.x, 32);
  assert.equal(menu.y, 52);
  assert.equal(menu.title, 'editor.viewOptions');
  assert.equal(menu.items[0]?.id, 'groupBy');
  assert.deepEqual(
    menu.items[0]?.items?.map((item) => item?.id),
    ['groupBy:flat', 'groupBy:module', 'groupBy:directory'],
  );
  assert.equal(
    menu.items[0]?.items?.every((item) => item?.keepOpen === true),
    true,
  );
});

test('Commit Options preserves busy state, action order and callbacks', () => {
  const calls = [];
  const menu = commitOptionsMenu({
    t,
    position: { x: 44, y: 66 },
    fetchBusy: true,
    updateBusy: false,
    commitBusy: true,
    stageAllAvailable: false,
    selectAllByDefault: false,
    groupBy: 'flat',
    onApplyChangeGroupBy: (mode) => calls.push(`group:${mode}`),
    onFetch: () => calls.push('fetch'),
    onUpdate: () => calls.push('update'),
    onApplyPatchFile: () => calls.push('patchFile'),
    onApplyPatchClipboard: () => calls.push('patchClipboard'),
    onStageAll: () => calls.push('stageAll'),
    onToggleSelectAllByDefault: () => calls.push('selectAllByDefault'),
    onStash: () => calls.push('stash'),
    onShelve: () => calls.push('shelve'),
  });

  assert.equal(menu.owner, 'commit-options');
  assert.equal(menu.title, 'editor.commitOptions');
  assert.deepEqual(
    menu.items.map((item) => item?.id ?? null),
    [
      'fetch',
      'update',
      null,
      'applyPatchFile',
      'applyPatchClipboard',
      null,
      'stageAll',
      'selectAllByDefault',
      null,
      'stash',
      'shelve',
      null,
      'groupBy',
    ],
  );
  assert.equal(childById(menu, 'fetch')?.label, 'editor.fetchBusy');
  assert.equal(childById(menu, 'fetch')?.disabled, true);
  assert.equal(childById(menu, 'update')?.label, 'editor.updateProject');
  assert.equal(childById(menu, 'update')?.disabled, true);
  assert.equal(childById(menu, 'applyPatchFile')?.disabled, true);
  assert.equal(childById(menu, 'applyPatchClipboard')?.disabled, true);
  assert.equal(childById(menu, 'stageAll')?.disabled, true);
  assert.equal(childById(menu, 'groupBy:flat')?.shortcut, '✓');
  assert.equal(childById(menu, 'groupBy:flat')?.keepOpen, false);

  for (const id of ['fetch', 'update', 'applyPatchFile', 'applyPatchClipboard', 'stageAll', 'stash', 'shelve']) {
    childById(menu, id).run();
  }
  childById(menu, 'groupBy:module').run();
  assert.deepEqual(calls, [
    'fetch',
    'update',
    'patchFile',
    'patchClipboard',
    'stageAll',
    'stash',
    'shelve',
    'group:module',
  ]);

  const updating = commitOptionsMenu({
    t,
    position: { x: 44, y: 66 },
    fetchBusy: false,
    updateBusy: true,
    commitBusy: false,
    stageAllAvailable: true,
    groupBy: 'flat',
    onApplyChangeGroupBy: () => {},
    onFetch: () => {},
    onUpdate: () => {},
    onApplyPatchFile: () => {},
    onApplyPatchClipboard: () => {},
    onStageAll: () => {},
    onStash: () => {},
    onShelve: () => {},
  });
  assert.equal(childById(updating, 'fetch')?.disabled, true);
  assert.equal(childById(updating, 'update')?.disabled, true);

  const pushing = commitOptionsMenu({
    t,
    position: { x: 44, y: 66 },
    fetchBusy: false,
    updateBusy: false,
    pushBusy: true,
    commitBusy: false,
    stageAllAvailable: true,
    groupBy: 'flat',
    onApplyChangeGroupBy: () => {},
    onFetch: () => {},
    onUpdate: () => {},
    onApplyPatchFile: () => {},
    onApplyPatchClipboard: () => {},
    onStageAll: () => {},
    onStash: () => {},
    onShelve: () => {},
  });
  assert.equal(childById(pushing, 'fetch')?.disabled, true);
  assert.equal(childById(pushing, 'update')?.disabled, true);
});

test('Commit Options disables Git-only actions when the workspace is not managed', () => {
  const menu = commitOptionsMenu({
    t,
    position: { x: 44, y: 66 },
    gitNotManaged: true,
    fetchBusy: false,
    updateBusy: false,
    commitBusy: false,
    stageAllAvailable: true,
    groupBy: 'flat',
    onApplyChangeGroupBy: () => {},
    onFetch: () => {},
    onUpdate: () => {},
    onApplyPatchFile: () => {},
    onApplyPatchClipboard: () => {},
    onStageAll: () => {},
    onStash: () => {},
    onShelve: () => {},
  });

  for (const id of ['fetch', 'update', 'applyPatchFile', 'applyPatchClipboard', 'stageAll', 'stash', 'shelve']) {
    assert.equal(childById(menu, id)?.disabled, true, `${id} must be disabled without Git`);
  }
  assert.equal(childById(menu, 'groupBy:flat')?.disabled, undefined);
});

test('editor workspace reuses the extracted Commit menu model', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(workspace, /changesViewOptionsMenu,\s+commitOptionsMenu\b/u);
  assert.match(workspace, /from '\.\/components\/commit\/commit-options-menu'/u);
  assert.match(workspace, /changesViewOptionsMenu\(\{/u);
  assert.match(workspace, /commitOptionsMenu\(\{/u);
  assert.match(workspace, /gitNotManaged: git\?\.isRepo === false/u);
  const viewOptions = workspace.slice(
    workspace.indexOf('const openChangesViewMenu = React.useCallback('),
    workspace.indexOf(
      '/**\n   * Open IDEA\'s "Move to…" picker',
      workspace.indexOf('const openChangesViewMenu = React.useCallback('),
    ),
  );
  assert.match(viewOptions, /const build = \(mode: string\): void =>/u);
  assert.match(viewOptions, /applyChangeGroupBy\(nextMode, false\);/u);
  assert.match(viewOptions, /build\(nextMode\);/u);
  assert.doesNotMatch(workspace, /owner: 'changes-view-options'/u);
  assert.doesNotMatch(workspace, /owner: 'commit-options'/u);
  assert.match(build, /commit-options-menu\.ts/u);
  assert.match(client, /function changesViewOptionsMenu\(/u);
  assert.match(client, /function commitOptionsMenu\(/u);
});
