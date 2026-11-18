import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const splitPaneSource = readFileSync(join(root, 'src/client/components/editor/EditorSplitPane.tsx'), 'utf8');

function treeMenu() {
  return source.slice(source.indexOf('const buildTreeMenu = React.useCallback('), source.indexOf('/* Move one entry into a directory by drag-and-drop'));
}

test('Project offers Split Open for files only', () => {
  const menu = treeMenu();
  assert.match(menu, /id: 'openRightSplit'/);
  assert.match(menu, /label: t\('editor\.openInSplit'\)/);
  assert.match(menu, /disabled: isRoot \|\| splitCandidates\.length === 0/);
  assert.match(menu, /openInRightSplit\(splitCandidates\)/);
  assert.ok(source.includes("openInSplit: '分屏打开'"));
  assert.ok(source.includes("openInSplit: 'Open in Split'"));
  assert.ok(source.includes("openInRightSplit: '在右侧拆分部分打开'"));
  assert.ok(source.includes("openInRightSplit: 'Open in Right Split'"));
});

test('EditorWorkspace owns an independent second editor group', () => {
  assert.match(source, /const \[splitPath, setSplitPath\] = React\.useState\(null\)/);
  assert.match(source, /const splitPathRef = React\.useRef\(null\)/);
  assert.match(source, /const splitEditorRef = React\.useRef\(null\)/);
  assert.match(source, /const splitContainerRef = React\.useRef\(null\)/);
  assert.match(source, /createCodeEditorGroup\(monaco, splitContainerRef\.current/);
  assert.match(source, /ensureEditorModel\(monaco, modelsRef\.current, path, file\.content\)/);
});

test('split Save uses its own path and sharing does not switch the left active tab', () => {
  assert.match(source, /const savePath = React\.useCallback\(/);
  assert.match(source, /onSave: \(\) => void savePath\(splitPathRef\.current\)/);
  const open = source.slice(source.indexOf('const openInRightSplit = React.useCallback('), source.indexOf('/* IDEA\'s project-tree context menu'));
  assert.match(open, /const previous = activePathRef\.current/);
  assert.match(open, /setActivePath\(previous\)/);
  assert.match(open, /setSplitPath\(path\)/);
});

test('split pane is a real Monaco surface with dirty badge and close action', () => {
  assert.match(source, /containerRef: splitContainerRef/);
  assert.match(splitPaneSource, /ref=\{containerRef\}/);
  assert.match(splitPaneSource, /<EditorSplitHeader/);
  assert.match(splitPaneSource, /data-dsh-editor-split=''/);
  assert.match(source, /t\('editor\.closeSplit'\)/);
  assert.match(source, /splitTabFile\?\.dirty === true/);
  assert.match(source, /setSplitPath\(null\)/);
});

test('file lifecycle remaps or clears the split path without disposing the shared model', () => {
  assert.match(source, /if \(splitPathRef\.current !== null\) \{\n\s+const next = remap\(splitPathRef\.current\)/);
  assert.match(source, /if \(splitPathRef\.current === path\) \{[\s\S]*?setSplitPath\(null\);[\s\S]*?\}/);
  assert.doesNotMatch(source, /splitEditorRef[\s\S]{0,200}model\.dispose/);
});
