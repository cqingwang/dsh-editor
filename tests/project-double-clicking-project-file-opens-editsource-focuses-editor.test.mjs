import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const panel =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const focusSurface = await readFile(new URL('../src/client/components/ui/focus-surface.ts', import.meta.url), 'utf8');

test('double-clicking a Project file opens EditSource and focuses the editor', () => {
  const rowStart = panel.indexOf('onRowDoubleClick={(state, event) => {');
  assert.notEqual(rowStart, -1);
  const row = panel.slice(rowStart, panel.indexOf('onRowContextMenu=', rowStart));
  assert.match(panel, /\n  onOpenEditSource,/);
  assert.match(row, /else if \(!isDirectory && singleClickOpen !== true\) onOpenEditSource\(row\.path\);/);
  assert.doesNotMatch(row, /else if \(!isDirectory && singleClickOpen !== true\) onOpen\(row\.path\);/);
  assert.match(workspace, /onOpenEditSource=\{editLocalVersion\}/u);
});

test('single-click selection stays in the tree while a speed-search file hit focuses the editor', () => {
  assert.match(panel, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);
  assert.match(panel, /if \(action === 'expand'\) onToggle\(hit\.path\);/);
  assert.match(panel, /else if \(action === 'open'\) \{\s*focusTree = false;\s*void onOpenEditSource\(hit\.path\)/u);
  assert.match(panel, /onRevealPath\?\.\(hit\.path\);/u);
  assert.match(panel, /if \(focusTree\) window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);/u);
  assert.match(workspace, /onOpenEditSource=\{editLocalVersion\}/u);
});

test('EditSource waits for Monaco to mount before taking keyboard focus', () => {
  const focusOnNextFrame = loadTypeScriptFunction(focusSurface, 'focusEditorOnNextFrame');
  const frames = [];
  const editorRef = { current: null };
  const focused = [];
  focusOnNextFrame(editorRef, (callback) => frames.push(callback), 4);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  editorRef.current = { focus: () => focused.push('editor') };
  frames.shift()();
  assert.deepEqual(focused, ['editor']);
  assert.match(workspace, /\(path: string\): Promise<boolean> =>/u);
  assert.match(workspace, /if \(opened\) focusEditorOnNextFrame\(editorRef\);/);
  assert.match(workspace, /return opened;/u);
  assert.doesNotMatch(
    workspace,
    /openFile\(path\)\.then\(\(\) => window\.setTimeout\(\(\) => editorRef\.current\?\.focus\(\), 0\)\)/,
  );
});
