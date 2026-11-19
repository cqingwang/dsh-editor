import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

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
  const closed = [];
  let diffTarget = { path: 'a.ts' };
  let diffActive = true;
  const closeEditorTabs = loadTypeScriptCallback(source, 'closeEditorTabs', {
    DIFF_TAB_KEY: '__diff__',
    closePaths: (paths) => {
      closed.push(paths);
      return true;
    },
    setDiffTarget: (value) => {
      diffTarget = value;
    },
    setDiffActive: (value) => {
      diffActive = value;
    },
    openFilesRef: { current: [{ path: 'a.ts' }, { path: 'b.ts' }] },
    diffReturnFocusRef: { current: null },
    focusWorkspaceFallback: () => false,
    document: { querySelector: () => null },
    window: { setTimeout: (callback) => callback() },
  });
  closeEditorTabs(['a.ts', '__diff__']);
  assert.deepEqual(closed, [['a.ts']]);
  assert.equal(diffTarget, null);
  assert.equal(diffActive, true);
  closeEditorTabs(['a.ts', 'b.ts', '__diff__']);
  assert.equal(diffActive, false);
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
