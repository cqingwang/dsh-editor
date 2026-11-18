import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

function optionsMenu() {
  return source.slice(source.indexOf('onOpenOptions: (event) => {'), source.indexOf('onCreateChange: (value) =>'));
}

test('Project Sort By is a value menu instead of a blind cycling action', () => {
  const options = optionsMenu();
  assert.match(options, /id: 'appearance'[\s\S]*?\['name', 'type', 'modified', 'modified-asc', 'manual'\]\.map/);
  assert.match(options, /id: `sort:\$\{mode\}`/);
  assert.match(options, /\['name', 'type', 'modified', 'modified-asc', 'manual'\]\.map/);
  assert.match(options, /shortcut: \(sortMode \?\? 'name'\) === mode \? '✓' : ''/);
  assert.match(options, /run: \(\) => runProjectOption\(\(\) => applySortMode\(mode\)\)/);
  assert.match(source, /const applySortMode = React\.useCallback\(\(next\) => \{/);
});

test('Show Hidden Files carries its current state in the same Options menu', () => {
  const options = optionsMenu();
  assert.match(options, /id: 'hidden', label: t\('editor\.showHidden'\), shortcut: showHidden \? '✓' : ''/);
  assert.doesNotMatch(options, /label: showHidden \? t\('editor\.hideHidden'\)/);
});

test('Commit toolbar aggregates low-frequency commands behind Options', () => {
  const start = source.indexOf('React.createElement(PanelToolbar, {', source.indexOf('function CommitPanel('));
  assert.notEqual(start, -1);
  const toolbar = source.slice(start, source.indexOf('historyMenu === null', start));
  assert.match(toolbar, /id: 'options',[\s\S]*?icon: 'settings',[\s\S]*?label: t\('editor\.options'\)/);
  assert.match(toolbar, /id: 'refresh', icon: 'refresh'/);
  assert.match(toolbar, /id: 'hide', icon: 'hide'/);
  assert.doesNotMatch(toolbar, /id: 'fetch',/);
  assert.doesNotMatch(toolbar, /id: 'stash',/);
  assert.doesNotMatch(toolbar, /id: 'shelve',/);

  const menu = source.slice(
    source.indexOf('const openCommitOptionsMenu = React.useCallback('),
    source.indexOf(
      'const commit = React.useCallback(',
      source.indexOf('const openCommitOptionsMenu = React.useCallback('),
    ),
  );
  for (const id of ['fetch', 'update', 'stash', 'shelve', 'groupBy']) {
    assert.match(menu, new RegExp(`id: '${id}'`));
  }
  assert.match(menu, /items: groupMenu\.items/);
  assert.match(menu, /fetchBusy/);
  assert.match(menu, /updateBusy/);
  assert.doesNotMatch(menu, /\bfetching\b/);
  assert.doesNotMatch(menu, /\bupdating\b/);
});

test('keyboard execution of a submenu child honours restoreFocus=false', () => {
  assert.match(menuSource, /if \(child\.restoreFocus === false\) skipReturnFocusRef\.current = true;/);
  assert.match(menuSource, /const openSubmenu = \(item: MenuAction\) => \{/);
});

test('the View-row control opens and closes Editor without becoming a tab', () => {
  const start = source.indexOf('function ensureChatToggle(');
  const block = source.slice(start, source.indexOf('function placeChatHandle(', start));
  assert.match(block, /data-dsh-editor-chat-toggle/);
  assert.match(block, /if \(active\) setActive\(false\);/);
  assert.match(block, /else\s+openEditorSplit\(\);/u);
  assert.doesNotMatch(block, /toggleChatCollapsed\(\)/);
  assert.match(
    source,
    /chatToggle\.setAttribute\('title', t\(active \? 'editor\.closeEditor' : 'editor\.openEditor'\)\)/,
  );
  assert.equal(source.split("openEditor: '").length - 1, 2);
  assert.equal(source.split("closeEditor: '").length - 1, 2);
});
