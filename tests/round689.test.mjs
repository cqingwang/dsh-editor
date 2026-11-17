import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

const parseGotoLinePosition = new Function(
  `${extractFunction('parseGotoLinePosition')}; return parseGotoLinePosition;`,
)();
const gotoLineShortcutMatches = new Function(
  `${extractFunction('gotoLineShortcutMatches')}; return gotoLineShortcutMatches;`,
)();

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
  const leftStart = source.indexOf('const tabs = openFiles.map((file) =>');
  const leftTab = source.slice(leftStart, source.indexOf('const diffIsCompare', leftStart));
  assert.match(leftTab, /role: 'tab'/);
  assert.match(leftTab, /'aria-selected': fileTabActive/);
  assert.match(leftTab, /tabIndex: fileTabActive \? 0 : -1/);
  assert.match(leftTab, /gotoLineShortcutMatches\(event\)/);
  assert.match(leftTab, /gotoLine\(file\.path, 'left'\)/);

  const splitTab = source.slice(
    source.indexOf("'data-dsh-editor-split-path': splitTab"),
    source.indexOf('draggable: true,', source.indexOf("'data-dsh-editor-split-path': splitTab")),
  );
  assert.match(splitTab, /gotoLineShortcutMatches\(event\)/);
  assert.match(splitTab, /gotoLine\(splitTab, 'right'\)/);
});

test('The line prompt is a floating IDEA-style popup with actionable errors', () => {
  const popup = source.slice(
    source.indexOf('gotoState === null'),
    source.indexOf('replaceState === null', source.indexOf('gotoState === null')),
  );
  assert.match(popup, /role: 'dialog'/);
  assert.match(popup, /'data-dsh-editor-goto-input': ''/);
  assert.match(popup, /'aria-invalid': gotoState\.error !== null/);
  assert.match(popup, /event\.key === 'Enter'[\s\S]*?commitGotoLine\(\)/);
  assert.match(popup, /event\.key === 'Escape'[\s\S]*?closeGotoLine\(\)/);
  assert.match(source, /gotoLinePopup:\s*\{[\s\S]*?position: 'absolute'/);
  assert.match(source, /editorSurface:\s*\{[\s\S]*?position: 'relative'/);
});

test('Commit uses the popup target path and pane and keeps invalid input open', () => {
  const goto = source.slice(
    source.indexOf('const gotoLine = React.useCallback('),
    source.indexOf('/* A terminal link asks the editor'),
  );
  assert.match(goto, /setGotoState\(\{ value: '', error: null, path: targetPath, pane: targetPane \}\)/);
  assert.match(goto, /const parsed = parseGotoLinePosition\(gotoState\?\.value\)/);
  assert.match(goto, /if \(parsed === null\)[\s\S]*?setGotoState\(\(current\) => current === null[\s\S]*?error:/);
  assert.match(goto, /const path = gotoState\.path/);
  assert.match(goto, /const pane = gotoState\.pane/);
  assert.match(goto, /revealLines\(path, parsed\.line, parsed\.column, pane\)/);
});
