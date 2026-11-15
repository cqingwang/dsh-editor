import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the tab offset command reuses reorderTabPaths and respects strip boundaries', () => {
  const move = source.slice(
    source.indexOf('const moveEditorTabByOffset = React.useCallback('),
    source.indexOf('const dropEditorTab = React.useCallback('),
  );
  assert.match(move, /group === 'left'/);
  assert.match(move, /openFilesRef\.current\.map\(\(file\) => file\.path\)/);
  assert.match(move, /splitTabsRef\.current/);
  assert.match(move, /const target = index < 0 \? undefined : order\[index \+ direction\]/);
  assert.match(move, /moveEditorTab\(group, path, target, direction > 0\)/);
});

test('left file tab menu exposes Move Left and Move Right with boundary disabling', () => {
  const fileTab = source.slice(source.indexOf('const tabs = openFiles.map('), source.indexOf('/**\n       * The diff\'s own editor tab'));
  assert.match(fileTab, /const openIndex = openFiles\.findIndex\(\(entry\) => entry\.path === file\.path\)/);
  assert.match(fileTab, /id: 'moveLeft', label: t\('editor\.terminalMoveLeft'\), disabled: openIndex <= 0, run: \(\) => moveEditorTabByOffset\('left', file\.path, -1\)/);
  assert.match(fileTab, /id: 'moveRight', label: t\('editor\.terminalMoveRight'\), disabled: openIndex < 0 \|\| openIndex >= openFiles\.length - 1, run: \(\) => moveEditorTabByOffset\('left', file\.path, 1\)/);
});

test('right split tab menu exposes the same Move Left and Move Right actions', () => {
  const splitTab = source.slice(source.indexOf("'data-dsh-editor-split-path': splitTab"), source.indexOf("splitTabFile?.dirty === true", source.indexOf("'data-dsh-editor-split-path': splitTab")));
  assert.match(splitTab, /id: 'moveLeft'/);
  assert.match(splitTab, /disabled: splitTabIndex <= 0/);
  assert.match(splitTab, /moveEditorTabByOffset\('right', splitTab, -1\)/);
  assert.match(splitTab, /id: 'moveRight'/);
  assert.match(splitTab, /disabled: splitTabIndex < 0 \|\| splitTabIndex >= splitTabs\.length - 1/);
  assert.match(splitTab, /moveEditorTabByOffset\('right', splitTab, 1\)/);
});

test('menu reordering leaves the active document and editor instances untouched', () => {
  const move = source.slice(
    source.indexOf('const moveEditorTab = React.useCallback('),
    source.indexOf('const moveEditorTabByOffset = React.useCallback('),
  );
  assert.doesNotMatch(move, /setActivePath|setSplitPath|createCodeEditorGroup|\.dispose\(/);
  assert.match(move, /setOpenFiles\(next\)/);
  assert.match(move, /setSplitTabs\(next\)/);
});
