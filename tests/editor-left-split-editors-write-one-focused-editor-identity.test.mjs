import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = [
  workspaceSource,
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8'),
].join('\n');

test('left and split editors write one focused editor identity', () => {
  const leftEditor = { focus: () => {}, getModel: () => ({ path: 'left.ts' }) };
  const rightEditor = { focus: () => {}, getModel: () => ({ path: 'right.ts' }) };
  const focusedEditorRef = { current: { path: 'right.ts', editor: rightEditor } };
  const focusedPathRef = { current: 'right.ts' };
  const activePathRef = { current: 'left.ts' };
  const editorRef = { current: leftEditor };
  const currentCodeEditor = loadTypeScriptCallback(workspaceSource, 'currentCodeEditor', {
    focusedEditorRef,
    editorRef,
  });
  const currentCodePath = loadTypeScriptCallback(workspaceSource, 'currentCodePath', {
    focusedEditorRef,
    focusedPathRef,
    activePathRef,
  });
  assert.equal(currentCodeEditor(), rightEditor);
  assert.equal(currentCodePath(), 'right.ts');
  focusedEditorRef.current = null;
  focusedPathRef.current = null;
  assert.equal(currentCodeEditor(), leftEditor);
  assert.equal(currentCodePath(), 'left.ts');
});

test('Find, Replace and Go to Line use the focused editor path and model', () => {
  const updateFind = source.slice(source.indexOf('const updateFind = React.useCallback('), source.indexOf('/* Move the editor selection to the next/previous match. */'));
  assert.match(updateFind, /const path = currentCodePath\(\)/);
  assert.match(updateFind, /modelsRef\.current\.get\(path\)/);

  const jump = source.slice(source.indexOf('const jumpToMatch = React.useCallback('), source.indexOf('const replaceAll = React.useCallback('));
  assert.match(jump, /const editor = currentCodeEditor\(\)/);

  const replace = source.slice(source.indexOf('const replaceAll = React.useCallback('), source.indexOf('const closeFind = React.useCallback('));
  assert.match(replace, /const editor = currentCodeEditor\(\)/);

  const goto = source.slice(source.indexOf('const commitGotoLine = React.useCallback('), source.indexOf('/* A terminal link asks the editor'));
  assert.match(goto, /const path = gotoState\.path/);
  assert.match(goto, /revealLines\(path, parsed\.line, parsed\.column, pane\)/);
});

test('Reveal Lines and Copy Path:Line select the focused editor for that path', () => {
  const reveal = source.slice(source.indexOf('const revealLines = React.useCallback('), source.indexOf('/** Transient status-bar message'));
  assert.match(reveal, /const focused = focusedEditorRef\.current/);
  assert.match(reveal, /focused\?\.path === path/);
  assert.match(reveal, /const preferred =\s+pane === 'right' \? splitEditorRef\.current : pane === 'left' \? editorRef\.current : null/);
  assert.match(reveal, /path === splitPathRef\.current[\s\S]*?splitEditorRef\.current[\s\S]*?: editorRef\.current/);

  const menu = source.slice(source.indexOf('const buildTreeMenu = React.useCallback('), source.indexOf('/* Move one entry into a directory by drag-and-drop'));
  assert.match(menu, /editor: currentCodeEditor\(\)/);
  assert.match(menu, /editorPath: currentCodePath\(\)/);
  const helper = source.slice(source.indexOf('function copyReferenceMenuItems('), source.indexOf('/**\n     * Choose an icon', source.indexOf('function copyReferenceMenuItems(')));
  assert.match(helper, /pathWithLine\([\s\S]*?editorPath === firstPath/);
});

test('closing split restores focused identity to the left editor', () => {
  assert.match(source, /focusedEditorRef\.current = \{ path: activePathRef\.current, editor \}/);
  assert.match(source, /focusedPathRef\.current = activePathRef\.current/);
});
