import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

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
  assert.match(source, /const openIndex = openFiles\.findIndex\(\(entry\) => entry\.path === file\.path\)/);
  assert.match(source, /id: 'moveLeft',[\s\S]*?disabled: openIndex <= 0,[\s\S]*?moveEditorTabByOffset\('left', file\.path, -1\)/);
  assert.match(source, /id: 'moveRight',[\s\S]*?disabled: openIndex < 0 \|\| openIndex >= openFiles\.length - 1,[\s\S]*?moveEditorTabByOffset\('left', file\.path, 1\)/);
});

test('right split tab menu exposes the same Move Left and Move Right actions', () => {
  const attributeAt = source.indexOf("dataAttributeName='data-dsh-editor-split-path'");
  const start = source.lastIndexOf('<EditorFileTab', attributeAt);
  const splitTab = source.slice(start, source.indexOf('\n                          splitTabLayout.hidden.length === 0', start));
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
