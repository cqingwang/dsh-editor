import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const locales = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');

function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

test('batch close replaces the open-tab state once and keeps the strip order', () => {
  const close = slice('const closePaths = React.useCallback(', 'const closeOtherTabs =');
  assert.match(close, /const before = openFilesRef\.current;/);
  assert.match(close, /const remaining = before\.filter\(\(file\) => wanted\.has\(file\.path\) === false\);/);
  assert.match(close, /setOpenFiles\(remaining\);/);
  assert.doesNotMatch(close, /for \(const path of paths\) closeFile/);
  assert.match(close, /const index = before\.findIndex\(\(file\) => file\.path === active\);/);
  assert.match(close, /remaining\[Math\.min\(Math\.max\(index, 0\), remaining\.length - 1\)\]/);
});

test('close to left/right uses the combined diff + file tab order', () => {
  const close = slice('const closeEditorTabs = React.useCallback(', '/* Cmd/Ctrl+Shift+O opens');
  assert.match(close, /const includesDiff = wanted\.has\(DIFF_TAB_KEY\);/);
  assert.match(close, /const fileKeys = \[\.\.\.wanted\]\.filter\(\(key\) => key !== DIFF_TAB_KEY\);/);
  assert.match(close, /if \(includesDiff\) \{[\s\S]*?setDiffTarget\(null\);/);
  assert.doesNotMatch(close, /else if \(activePathRef\.current !== null\) setDiffActive\(false\)/);

  const fileMenu = slice('onContextMenu={(event) => {', 'onClose={() => closeFile(file.path)}');
  assert.match(fileMenu, /const tabIndex = allTabs\.indexOf\(file\);/);
  assert.match(fileMenu, /closeEditorTabs\(allTabs\.slice\(0, tabIndex\)\)/);
  assert.match(fileMenu, /closeEditorTabs\(allTabs\.slice\(tabIndex \+ 1\)\)/);
  assert.match(fileMenu, /id: 'closeLeft',\s+label: t\('editor\.closeTabsLeft'\)/u);
  assert.match(fileMenu, /id: 'closeRight',\s+label: t\('editor\.closeTabsRight'\)/u);

  const diffMenu = slice("key='dsh-editor-difftab'", '/* One layout for this render');
  assert.match(diffMenu, /id: 'closeOthers',\s+label: t\('editor\.closeOtherTabs'\)/u);
  assert.match(diffMenu, /id: 'closeRight',\s+label: t\('editor\.closeTabsRight'\)/u);
  assert.match(diffMenu, /id: 'closeAll',\s+label: t\('editor\.closeAllTabs'\)/u);
});

test('closeDiff clears the diff tab active flag and activates a neighbouring file tab', () => {
  const diff = slice('const closeDiff = React.useCallback(', 'React.useEffect(() => {\n    selectedCommitPathRef');
  assert.match(diff, /setDiffTarget\(null\);/);
  assert.match(diff, /setDiffActive\(false\);/);
  assert.match(diff, /const path = activePathRef\.current;/);
  assert.match(diff, /editorRef\.current\?\.focus\(\)/);
});

test('close-menu copy exists in both dictionaries', () => {
  assert.match(locales, /closeTabsLeft: '关闭左侧标签页'/);
  assert.match(locales, /closeTabsRight: '关闭右侧标签页'/);
  assert.match(locales, /closeTabsLeft: 'Close Tabs to the Left'/);
  assert.match(locales, /closeTabsRight: 'Close Tabs to the Right'/);
});
