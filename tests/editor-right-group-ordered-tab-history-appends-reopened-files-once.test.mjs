import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const editorFileTabSource = readFileSync(join(root, 'src/client/components/editor/EditorFileTab.tsx'), 'utf8');

function closeSplitTab() {
  const start = source.indexOf('const closeSplitTab = React.useCallback(');
  assert.notEqual(start, -1);
  return source.slice(start, source.indexOf('const closeFile = React.useCallback(', start));
}

test('right group keeps an ordered tab history and appends reopened files once', () => {
  assert.match(source, /const \[splitTabs, setSplitTabs\] = React\.useState(?:<[^>]+>)?\(\[\]\)/);
  assert.match(source, /const splitTabsRef = React\.useRef(?:<[^>]+>)?\(\[\]\)/);
  const open = source.slice(source.indexOf('const openInRightSplit = React.useCallback('), source.indexOf('/**\n       * Save one open model by path.'));
  assert.match(open, /setSplitTabs\(\(current\) => current\.includes\(path\) \? current : \[\.\.\.current, path\]\)/);
  assert.match(open, /splitTabsRef\.current = nextSplitTabs/);
  assert.match(open, /setSplitPath\(path\)/);
});

test('closing an active right tab falls back to its neighbour', () => {
  const close = closeSplitTab();
  assert.match(close, /const index = current\.indexOf\(path\)/);
  assert.match(close, /const next = current\.filter\(\(entry\) => entry !== path\)/);
  assert.match(close, /next\[Math\.min\(index, next\.length - 1\)\]/);
  assert.match(close, /setSplitPath\(fallback\)/);
});

test('right pane renders a real tab strip with per-tab close and whole-split close', () => {
  assert.match(source, /'data-dsh-editor-split-tabs': ''/);
  assert.match(source, /dataAttributeName: 'data-dsh-editor-split-path'/);
  assert.match(source, /onActivate: \(\) => \{[\s\S]*?setSplitPath\(splitTab\)/);
  assert.match(editorFileTabSource, /role='tab'/);
  assert.match(editorFileTabSource, /onClick=\{onActivate\}/);
  assert.match(source, /t\('editor\.closeTab', \{ name: basename\(splitTab\) \}\)/);
  assert.match(source, /t\('editor\.closeSplit'\)/);
});

test('switching right tabs reuses the editor instance and only rebinds the shared model', () => {
  const groupEffect = source.slice(source.indexOf('/* The right split is a second view over the same workspace model. */'), source.indexOf('React.useEffect(() => {\n        if (splitPath !== null && !openFiles.some'));
  const createAt = groupEffect.indexOf('createCodeEditorGroup(');
  const bindAt = groupEffect.indexOf('const bindActiveModel = React.useCallback(');
  assert.ok(createAt >= 0 && bindAt > createAt);
  const bind = groupEffect.slice(bindAt, groupEffect.indexOf('React.useEffect(() => {\n        bindActiveModel();', bindAt));
  assert.match(bind, /editor\.setModel\(model\)/);
  assert.doesNotMatch(bind, /createCodeEditorGroup\(/);
});

test('file lifecycle removes invalid split tabs and remaps renamed paths', () => {
  assert.match(source, /setSplitTabs\(\(current\) => current\.filter\(\(path\) => openFiles\.some\(\(file\) => file\.path === path\)\)\)/);
  assert.match(source, /setSplitTabs\(\(current\) => \{[\s\S]*?const next = remap\(path\)/);
  assert.match(source, /const remaining = splitTabsRef\.current\.filter\(\(path\) => wanted\.has\(path\) === false\)/);
});
