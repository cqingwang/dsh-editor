import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const optionsSource = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const localesSource = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
const source = [projectPanelSource, workspaceSource, optionsSource, localesSource].join('\n');

function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

function projectPanel() {
  return projectPanelSource;
}

test('the Project toolbar follows IDEA action density', () => {
  const panel = projectPanel();
  const toolbar = slice('right={[', 'dropActive={toolbarDropActive}');

  assert.match(projectPanelSource, /<PanelToolbar\s+dense\s+t=\{t\}/u);
  assert.match(toolbar, /id: 'reveal',[\s\S]*?icon: 'target',[\s\S]*?label: t\('editor\.reveal'\)/);
  assert.match(toolbar, /id: 'collapse',[\s\S]*?group: 'navigation',[\s\S]*?icon: 'collapse'[\s\S]*?label: t\('editor\.collapseAll'\)/);
  assert.match(toolbar, /id: 'hide',[\s\S]*?group: 'window',[\s\S]*?icon: 'hide'[\s\S]*?label: t\('editor\.hide'\)/);
  const directRight = slice('right={[', 'trailingRight={');
  const directTrailing = slice('trailingRight={', 'dropActive={toolbarDropActive}');
  assert.doesNotMatch(toolbar, /id: 'newEntry'/);
  assert.doesNotMatch(directRight, /id: 'options'/);
  assert.doesNotMatch(directRight, /id: 'hide'/);
  assert.match(directTrailing, /id: 'hide'/);
  assert.doesNotMatch(toolbar, /overflowMenuItems=/);

  /* IDEA's visible toolbar is not a second place to configure the tree. */
  assert.doesNotMatch(toolbar, /id: 'sort'/);
  assert.doesNotMatch(toolbar, /id: 'hidden'/);
  assert.doesNotMatch(toolbar, /id: 'autoscroll'/);
  assert.doesNotMatch(toolbar, /id: 'refresh'/);
  assert.doesNotMatch(toolbar, /id: 'gotoFile'/);
  assert.doesNotMatch(toolbar, /id: 'recent'/);
  assert.doesNotMatch(toolbar, /id: 'expandSelected'|projectCanExpandSelection|onExpandSelected|editor\.revealSelected/);
  assert.ok(panel.includes('projectMenuItems'));
});

test('the dense Project toolbar uses IDEA action pitch without shrinking icons', () => {
  assert.match(panelToolbarSource, /dense\?: boolean;/u);
  assert.match(panelToolbarSource, /const actionSlotWidth = dense \? 22 : 25;/u);
  assert.match(panelToolbarSource, /actionSlotWidth,\s+overflowMenuItems\.length,/u);
  assert.match(panelToolbarSource, /gap: dense \? 0 : 1,/u);
  assert.match(panelToolbarSource, /style=\{dense \? \{ width: 22 \} : null\}/u);
  assert.match(panelToolbarSource, /minWidth: dense \? 2 : 4/u);
  assert.match(panelToolbarSource, /overflowMenuItems\?: MenuEntry\[\];/u);
  assert.match(panelToolbarSource, /const overflowMenuEntries: MenuEntry\[\]/u);
  assert.match(panelToolbarSource, /observer\?\.observe\(titleRef\.current\)/u);
});

test('the shared toolbar renders More before the trailing Hide action', () => {
  const toolbar = panelToolbarSource;
  assert.match(toolbar, /const next = panelToolbarFit\(/);
  assert.match(toolbar, /const combinedRight = \[\.\.\.right, \.\.\.trailingRight\];/);
  assert.match(toolbar, /combinedRight\.slice\(0, combinedRight\.length - fits\.right\)/);
  const more = toolbar.indexOf("icon='more'");
  assert.ok(toolbar.indexOf('directRightBeforeTrailing.map(renderAction)') < more);
  assert.ok(more < toolbar.indexOf('directTrailing.map(renderAction)'));
  assert.doesNotMatch(toolbar, /right\.slice\(0, fits\.right\)\.map\(renderAction\)/);
});

test('Project toolbar no longer wires Expand Selected', () => {
  const panel = projectPanel();
  assert.doesNotMatch(panel, /projectCanExpandSelection|onExpandSelected|editor\.revealSelected/);
  assert.doesNotMatch(
    workspaceSource,
    /onExpandSelected|expandSelectedTree|projectCanExpandSelection/,
  );
});

test('Options keeps the hidden actions reachable in one grouped menu', () => {
  const wiring = optionsSource;
  for (const id of ['refresh', 'gotoFile', 'recent', 'behavior', 'appearance']) {
    assert.match(wiring, new RegExp(`id: '${id}'`));
  }
  assert.doesNotMatch(wiring, /id: 'expandAll'|expandAllAvailable|onExpandAll/);
  for (const id of ['singleClickOpen', 'openDirectoriesSingleClick', 'hidden']) {
    assert.match(wiring, new RegExp(`id: '${id}'`));
  }
  assert.doesNotMatch(wiring, /id: 'autoscroll'/);
  assert.match(workspaceSource, /onRefresh: \(\) => runProjectOption\(\(\) => void refreshTree\(\)\)/);
  assert.match(workspaceSource, /onGotoFile: \(\) => void openQuickOpen\(\)/);
  assert.match(workspaceSource, /onRecentFiles: openRecent/);
  assert.match(wiring, /\['name', 'type', 'modified', 'modified-asc', 'manual'\]\.map/);
  assert.match(workspaceSource, /onApplySortMode: \(mode\) => runProjectOption\(\(\) => applySortMode\(mode\)\)/);
});

test('the Project action menu leaves creation to the tree context menu', () => {
  const wiring = optionsSource;
  assert.doesNotMatch(wiring, /id: 'newFile'|id: 'newFolder'|onStartCreate/);
  assert.match(workspaceSource, /id: 'newFile',[\s\S]*?startCreate\('file', createParent\)/);
  assert.match(workspaceSource, /id: 'newFolder',[\s\S]*?startCreate\('directory', createParent\)/);
});

test('the removed Expand Selected action cannot return through locale wiring', () => {
  assert.doesNotMatch(source, /revealSelected:/);
});
