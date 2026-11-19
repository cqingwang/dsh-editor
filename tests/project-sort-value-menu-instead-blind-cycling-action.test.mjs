import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectOptions = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const commitPanel = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const commitOptions = readFileSync(join(root, 'src/client/components/commit/commit-options-menu.ts'), 'utf8');
const controller = readFileSync(join(root, 'src/client/controller.ts'), 'utf8');
const locales = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');

test('Project Sort By is a value menu instead of a blind cycling action', () => {
  assert.match(projectOptions, /id: 'appearance'[\s\S]*?\['name', 'type', 'modified', 'modified-asc', 'manual'\]\.map/);
  assert.match(projectOptions, /id: `sort:\$\{mode\}`/);
  assert.match(projectOptions, /shortcut: \(sortMode \?\? 'name'\) === mode \? '✓' : ''/);
  assert.match(projectOptions, /run: \(\) => onApplySortMode\(mode\)/);
  let persisted = null;
  const applySortMode = loadTypeScriptCallback(workspace, 'applySortMode', {
    setSortMode: () => {},
    window: {
      localStorage: {
        setItem: (key, value) => {
          persisted = [key, value];
        },
      },
    },
  });
  applySortMode('modified-asc');
  assert.deepEqual(persisted, ['dsh-editor.project.sort', 'modified-asc']);
});

test('Show Hidden Files carries its current state in the same Options menu', () => {
  assert.match(projectOptions, /id: 'hidden',[\s\S]*?label: t\('editor\.showHidden'\),[\s\S]*?shortcut: showHidden \? '✓' : ''/u);
  assert.doesNotMatch(projectOptions, /label: showHidden \? t\('editor\.hideHidden'\)/);
});

test('Commit toolbar aggregates low-frequency commands behind Options', () => {
  const start = commitPanel.indexOf('<PanelToolbar', commitPanel.indexOf('function CommitPanel('));
  assert.notEqual(start, -1);
  const toolbar = commitPanel.slice(start, commitPanel.indexOf('historyMenu === null', start));
  assert.match(toolbar, /id: 'options',[\s\S]*?icon: 'settings',[\s\S]*?label: t\('editor\.options'\)/);
  assert.match(toolbar, /id: 'refresh',[\s\S]*?icon: 'refresh'/);
  assert.match(toolbar, /id: 'hide',[\s\S]*?icon: 'hide'/);
  assert.doesNotMatch(toolbar, /id: 'fetch',/);
  assert.doesNotMatch(toolbar, /id: 'stash',/);
  assert.doesNotMatch(toolbar, /id: 'shelve',/);

  const menu = `${commitOptions}\n${workspace.slice(
    workspace.indexOf('const openCommitOptionsMenu = React.useCallback('),
    workspace.indexOf('const commit = React.useCallback(', workspace.indexOf('const openCommitOptionsMenu = React.useCallback(')),
  )}`;
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
  assert.match(
    menuSource,
    /if \(child\.keepOpen !== true && child\.restoreFocus === false\) \{\s+skipReturnFocusRef\.current = true;\s+\}/,
  );
  assert.match(menuSource, /const openSubmenu = \(item: MenuAction\) => \{/);
});

test('the View-row control opens and closes Editor without becoming a tab', () => {
  const start = controller.indexOf('function ensureChatToggle(');
  const block = controller.slice(start, controller.indexOf('function placeChatHandle(', start));
  assert.match(block, /data-dsh-editor-chat-toggle/);
  assert.match(block, /if \(active\) setActive\(false\);/);
  assert.match(block, /else\s+openEditorSplit\(\);/u);
  assert.doesNotMatch(block, /toggleChatCollapsed\(\)/);
  assert.match(
    controller,
    /chatToggle\.setAttribute\('title', t\(active \? 'editor\.closeEditor' : 'editor\.openEditor'\)\)/,
  );
  assert.equal(locales.split("openEditor: '").length - 1, 2);
  assert.equal(locales.split("closeEditor: '").length - 1, 2);
});
