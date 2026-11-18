import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

function sliceBetween(start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `${start} is missing`);
  const to = source.indexOf(end, from);
  assert.notEqual(to, -1, `${end} is missing after ${start}`);
  return source.slice(from, to);
}

test('closing a right-tab range confirms dirty files once and keeps shared documents', () => {
  const close = sliceBetween('const closeSplitTabs = React.useCallback(', 'const closeSplitTab = React.useCallback(');
  assert.match(close, /const doomed = splitTabsRef\.current\.filter\(\(path\) => wanted\.has\(path\)\)/);
  assert.match(
    close,
    /const dirty = doomed\.filter\(\s+\(path\) => openFilesRef\.current\.find\(\(file\) => file\.path === path\)\?\.dirty === true,\s+\)\.length;/u,
  );
  assert.match(close, /t\('editor\.unsavedTabsConfirm', \{ count: dirty \}\)/);
  assert.match(close, /const remaining = splitTabsRef\.current\.filter\(\(path\) => wanted\.has\(path\) === false\)/);
  assert.doesNotMatch(close, /model\?\.dispose|modelsRef\.current\.delete/);
});

test('right tab context menu closes only that group and targets the clicked tab', () => {
  const attributeAt = source.indexOf("dataAttributeName='data-dsh-editor-split-path'");
  const start = source.lastIndexOf('<EditorFileTab', attributeAt);
  const tab = source.slice(start, start + 7000);
  assert.match(tab, /onContextMenu=\{\(event\) => \{/);
  assert.match(tab, /id: 'closeOthers'/);
  assert.match(tab, /id: 'closeLeft'/);
  assert.match(tab, /id: 'closeRight'/);
  assert.match(tab, /id: 'closeAll'/);
  assert.match(tab, /closeSplitTabs\(splitTabs\.filter\(\(path\) => path !== splitTab\)\)/);
  assert.match(tab, /closeSplitTabs\(splitTabs\.slice\(0, splitTabIndex\)\)/);
  assert.match(tab, /closeSplitTabs\(splitTabs\.slice\(splitTabIndex \+ 1\)\)/);
  assert.match(tab, /savePath\(splitTab\)/);
  assert.match(tab, /revealPath\(splitTab\)/);
});

test('middle-click closes only the right group tab', () => {
  const attributeAt = source.indexOf("dataAttributeName='data-dsh-editor-split-path'");
  const start = source.lastIndexOf('<EditorFileTab', attributeAt);
  const tab = source.slice(start, start + 7000);
  assert.match(tab, /onAuxClick=\{\(event\) => \{/);
  assert.match(tab, /event\.button !== 1/);
  assert.match(tab, /closeSplitTab\(splitTab\)/);
});

test('Alt+Left/Right cycles only the focused right group history', () => {
  const cycle = sliceBetween('const cycleSplitTab = React.useCallback(', '/** Close the entire right editor group');
  assert.match(cycle, /const tabs = splitTabsRef\.current/);
  assert.match(cycle, /\(index \+ step \+ tabs\.length\) % tabs\.length/);
  assert.match(cycle, /splitPathRef\.current = next/);
  assert.match(cycle, /setSplitPath\(next\)/);

  const shortcut = sliceBetween('const splitTabShortcut =', 'React.useEffect(() => {\n    window.addEventListener(\'keydown\', splitTabShortcut, true);');
  assert.match(shortcut, /event\.altKey/);
  assert.match(shortcut, /event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey/);
  assert.match(shortcut, /splitContainerRef\.current\?\.contains\(target\)/);
  assert.match(shortcut, /cycleSplitTab\(event\.key === 'ArrowRight' \? 1 : -1\)/);
});
