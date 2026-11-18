import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const editorFileTabSource = readFileSync(join(root, 'src/client/components/editor/EditorFileTab.tsx'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
}

const reorderTabPaths = new Function(
  `${extractFunction('reorderTabPaths')}; return reorderTabPaths;`,
)();

test('tab reorder respects the insertion side and rejects no-op drops', () => {
  const files = [{ path: 'a' }, { path: 'b' }, { path: 'c' }];
  const idOf = (file) => file.path;
  assert.deepEqual(reorderTabPaths(files, 'a', 'c', false, idOf).map(idOf), ['b', 'a', 'c']);
  assert.deepEqual(reorderTabPaths(files, 'a', 'c', true, idOf).map(idOf), ['b', 'c', 'a']);
  assert.deepEqual(reorderTabPaths(files, 'c', 'a', false, idOf).map(idOf), ['c', 'a', 'b']);
  assert.equal(reorderTabPaths(files, 'a', 'a', true, idOf), files);
  assert.equal(reorderTabPaths(files, 'missing', 'a', false, idOf), files);
});

test('editor tabs expose IDE-style drag state and insertion side', () => {
  assert.match(source, /const \[editorTabDrag, setEditorTabDrag\] = React\.useState\(null\)/);
  assert.match(source, /const \[editorTabDrop, setEditorTabDrop\] = React\.useState\(null\)/);
  assert.match(source, /const editorTabDragRef = React\.useRef\(null\)/);
  assert.match(source, /const beginEditorTabDrag = React\.useCallback\(/);
  assert.match(source, /const dragOverEditorTab = React\.useCallback\(/);
  assert.match(source, /const dropEditorTab = React\.useCallback\(/);
  assert.match(source, /after: event\.clientX > rect\.left \+ rect\.width \/ 2/);
});

test('left and right tab drops reorder only their own collection', () => {
  const move = source.slice(
    source.indexOf('const moveEditorTab = React.useCallback('),
    source.indexOf('const dropEditorTab = React.useCallback('),
  );
  assert.match(move, /if \(group === 'left'\)/);
  assert.match(move, /const next = reorderTabPaths\(openFilesRef\.current, source, target, after, \(file\) => file\.path\)/);
  assert.match(move, /openFilesRef\.current = next/);
  assert.match(move, /setOpenFiles\(next\)/);
  assert.match(move, /if \(group === 'right'\)/);
  assert.match(move, /reorderTabPaths\(splitTabsRef\.current, source, target, after, \(path\) => path\)/);
  assert.match(move, /splitTabsRef\.current = next/);
  assert.match(move, /setSplitTabs\(next\)/);
  assert.doesNotMatch(move, /createCodeEditorGroup\(|modelsRef\.current\.delete|\.dispose\(/);
});

test('left file tabs and right split tabs are draggable with per-target hints', () => {
  const leftTab = source.slice(source.indexOf('const tabs = openFiles.map('), source.indexOf('/**\n       * The diff\'s own editor tab'));
  assert.match(editorFileTabSource, /draggable=\{true\}/);
  assert.match(leftTab, /onDragStart: \(event\) => beginEditorTabDrag\(event, 'left', file\.path\)/);
  assert.match(leftTab, /onDragOver: \(event\) => dragOverEditorTab\(event, 'left', file\.path\)/);
  assert.match(leftTab, /onDrop: \(event\) => dropEditorTab\(event, 'left', file\.path\)/);
  assert.match(leftTab, /editorTabDrop\?\.group === 'left' && editorTabDrop\.path === file\.path/);

  const attributeAt = source.indexOf("dataAttributeName: 'data-dsh-editor-split-path'");
  const splitStart = source.lastIndexOf('return React.createElement(EditorFileTab', attributeAt);
  const splitTab = source.slice(splitStart, source.indexOf('\n                          splitTabLayout.hidden.length === 0', splitStart));
  assert.match(editorFileTabSource, /draggable=\{true\}/);
  assert.match(splitTab, /onDragStart: \(event\) => beginEditorTabDrag\(event, 'right', splitTab\)/);
  assert.match(splitTab, /onDragOver: \(event\) => dragOverEditorTab\(event, 'right', splitTab\)/);
  assert.match(splitTab, /onDrop: \(event\) => dropEditorTab\(event, 'right', splitTab\)/);
  assert.match(editorFileTabSource, /onDragStart=\{onDragStart\}/);
  assert.match(editorFileTabSource, /onDrop=\{onDrop\}/);
});
