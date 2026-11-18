import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8'));
const navigationModel = await readFile(
  new URL('../src/client/components/editor/editor-navigation-model.ts', import.meta.url),
  'utf8',
);
const gotoPopupSource = await readFile(
  new URL('../src/client/components/editor/EditorGotoLinePopup.tsx', import.meta.url),
  'utf8',
);
const editorFileTabSource = await readFile(
  new URL('../src/client/components/editor/EditorFileTab.tsx', import.meta.url),
  'utf8',
);

const parseGotoLinePosition = loadTypeScriptFunction(navigationModel, 'parseGotoLinePosition');
const gotoLineShortcutMatches = loadTypeScriptFunction(navigationModel, 'gotoLineShortcutMatches');

test('Go to Line accepts a line or line:column and rejects malformed positions', () => {
  assert.deepEqual(parseGotoLinePosition('12'), { line: 12, column: 1 });
  assert.deepEqual(parseGotoLinePosition(' 12:7 '), { line: 12, column: 7 });
  assert.deepEqual(parseGotoLinePosition('12, 7'), { line: 12, column: 7 });
  assert.equal(parseGotoLinePosition(''), null);
  assert.equal(parseGotoLinePosition('0:1'), null);
  assert.equal(parseGotoLinePosition('12:0'), null);
  assert.equal(parseGotoLinePosition('line:7'), null);
  assert.equal(parseGotoLinePosition('12:7:2'), null);
});

test('Only Cmd/Ctrl+L without modifiers is the Go to Line shortcut', () => {
  const event = (overrides = {}) => ({
    key: 'l',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });
  assert.equal(gotoLineShortcutMatches(event({ metaKey: true })), true);
  assert.equal(gotoLineShortcutMatches(event({ ctrlKey: true })), true);
  assert.equal(gotoLineShortcutMatches(event()), false);
  assert.equal(gotoLineShortcutMatches(event({ metaKey: true, shiftKey: true })), false);
  assert.equal(gotoLineShortcutMatches(event({ metaKey: true, altKey: true })), false);
  assert.equal(gotoLineShortcutMatches(event({ metaKey: true, isComposing: true })), false);
});

test('Focused file and split tabs own Cmd/Ctrl+L and open their own target', () => {
  assert.match(editorFileTabSource, /role='tab'/);
  assert.match(editorFileTabSource, /aria-selected=\{active\}/);
  assert.match(editorFileTabSource, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(source, /gotoLineShortcutMatches\(event\)[\s\S]{0,160}?gotoLine\(file\.path, 'left'\)/);
  assert.match(source, /gotoLineShortcutMatches\(event\)[\s\S]{0,160}?gotoLine\(splitTab, 'right'\)/);
});

test('The line prompt is a floating IDEA-style popup with actionable errors', () => {
  assert.match(gotoPopupSource, /role='dialog'/);
  assert.match(gotoPopupSource, /data-dsh-editor-goto-input=''/);
  assert.match(gotoPopupSource, /aria-invalid=\{state\.error !== null\}/);
  assert.match(gotoPopupSource, /event\.key === 'Enter'[\s\S]*?onSubmit\(\)/);
  assert.match(gotoPopupSource, /event\.key === 'Escape'[\s\S]*?onClose\(\)/);
  assert.match(source, /<EditorGotoLinePopup/);
  assert.match(source, /gotoLinePopup:\s*\{[\s\S]*?position: 'absolute'/);
  assert.match(source, /editorSurface:\s*\{[\s\S]*?position: 'relative'/);
});

test('Commit uses the popup target path and pane and keeps invalid input open', () => {
  const goto = source.slice(
    source.indexOf('const gotoLine = React.useCallback('),
    source.indexOf('/* A terminal link asks the editor'),
  );
  assert.match(
    goto,
    /setGotoState\(\{\s*value: '',\s*error: null,\s*path: targetPath,\s*pane: targetPane,\s*\}\)/,
  );
  assert.match(goto, /const parsed = parseGotoLinePosition\(gotoState\?\.value\)/);
  assert.match(goto, /if \(parsed === null\)[\s\S]*?error: t\('editor\.gotoLineInvalid'\)/);
  assert.match(goto, /const path = gotoState\.path/);
  assert.match(goto, /const pane = gotoState\.pane/);
  assert.match(goto, /revealLines\(path, parsed\.line, parsed\.column, pane\)/);
});
