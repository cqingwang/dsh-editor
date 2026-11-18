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
  const toolbar = slice('left={[', 'dropActive={toolbarDropActive}');

  assert.match(toolbar, /id: 'newEntry'/);
  assert.match(toolbar, /id: 'reveal',[\s\S]*?icon: 'target',[\s\S]*?label: t\('editor\.reveal'\)/);
  assert.match(toolbar, /id: 'expandSelected'/);
  assert.match(toolbar, /id: 'collapse',[\s\S]*?group: 'navigation',[\s\S]*?icon: 'collapse'[\s\S]*?label: t\('editor\.collapseAll'\)/);
  assert.match(toolbar, /id: 'options',[\s\S]*?icon: 'settings',[\s\S]*?label: t\('editor\.options'\)/);
  assert.match(toolbar, /id: 'hide',[\s\S]*?group: 'window',[\s\S]*?icon: 'hide'[\s\S]*?label: t\('editor\.hide'\)/);

  /* IDEA's visible toolbar is not a second place to configure the tree. */
  assert.doesNotMatch(toolbar, /id: 'sort'/);
  assert.doesNotMatch(toolbar, /id: 'hidden'/);
  assert.doesNotMatch(toolbar, /id: 'autoscroll'/);
  assert.doesNotMatch(toolbar, /id: 'refresh'/);
  assert.doesNotMatch(toolbar, /id: 'gotoFile'/);
  assert.doesNotMatch(toolbar, /id: 'recent'/);
  assert.ok(panel.includes('onOpenOptions'));
});

test('the right toolbar group keeps Options and Hide while the middle overflows', () => {
  const toolbar = panelToolbarSource;
  assert.match(toolbar, /const next = panelToolbarFit\(/);
  assert.match(toolbar, /right\.length - fits\.right/);
  assert.match(toolbar, /right\.slice\(right\.length - fits\.right\)\.map\(renderAction\)/);
  assert.match(toolbar, /right\.slice\(0, right\.length - fits\.right\)/);
  assert.doesNotMatch(toolbar, /right\.slice\(0, fits\.right\)\.map\(renderAction\)/);
  assert.doesNotMatch(toolbar, /\.\.\.right\.slice\(fits\.right\)/);
});

test('Expand Selected follows IDEA recursive selection semantics', () => {
  const panel = projectPanel();
  assert.match(panel, /disabled: !projectCanExpandSelection\(rows, selection\)/);
  assert.match(panel, /label: t\('editor\.revealSelected'\)/);

  const wiring = workspaceSource.slice(
    workspaceSource.indexOf('onExpandSelected='),
    workspaceSource.indexOf('onExpandAll={expandAll}'),
  );
  assert.match(wiring, /void expandSelectedTree\(\)/);
});

test('Options keeps the hidden actions reachable in one grouped menu', () => {
  const wiring = optionsSource;
  for (const id of ['refresh', 'gotoFile', 'recent', 'expandAll', 'behavior', 'appearance']) {
    assert.match(wiring, new RegExp(`id: '${id}'`));
  }
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

test('the creation entry opens IDEA File and Directory choices', () => {
  const wiring = optionsSource;
  assert.match(wiring, /id: 'newFile'/);
  assert.match(wiring, /id: 'newFolder'/);
  assert.match(wiring, /shortcut: '⌘N'/);
  assert.match(wiring, /shortcut: '⌥⌘N'/);
  assert.match(wiring, /onStartCreate\('file'\)/);
  assert.match(wiring, /onStartCreate\('directory'\)/);
});

test('both locale dictionaries describe Expand Selected consistently', () => {
  assert.match(source, /revealSelected: '展开所选'/);
  assert.match(source, /revealSelected: 'Expand Selected'/);
});
