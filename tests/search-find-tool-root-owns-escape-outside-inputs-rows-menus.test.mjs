import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findStart = source.indexOf('function FindToolWindowView(');
const findEnd = source.indexOf('const FindToolWindow = FindToolWindowView;', findStart);
const find = source.slice(findStart, findEnd);
const panelStart = source.indexOf('<FindToolWindow');
const panelClose = 'onClose={closeFindToolWindow}';
const panelEnd = source.indexOf(panelClose, panelStart);
const panel = source.slice(panelStart, panelEnd + panelClose.length);

test('Find tool root owns Escape outside inputs, rows and menus', () => {
  assert.match(
    find,
    /const handleFindToolRootKeyDown = \(event: React\.KeyboardEvent<HTMLDivElement>\): void => \{[\s\S]*?event\.key !== 'Escape'[\s\S]*?event\.defaultPrevented[\s\S]*?closest\('\[role="menu"\]'\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onClose\(\)/,
  );
  assert.match(find, /onKeyDown=\{handleFindToolRootKeyDown\}/);
  assert.doesNotMatch(find, /document\.body\.focus/);
});

test('replacement Escape cannot double-close through the tool root', () => {
  const replacementStart = find.indexOf("data-dsh-find-replace-input=''");
  const replacementEnd = find.indexOf('<ToolbarButton', replacementStart);
  const replacement = find.slice(replacementStart, replacementEnd);
  assert.match(
    replacement,
    /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onClose\(\)/,
  );
});

test('closing the Find tool restores its opener, editor, or workspace fallback', () => {
  assert.match(
    source,
    /const closeFindToolWindow = React\.useCallback\(\(\) => \{[\s\S]*?const previous = findToolReturnFocusRef\.current;[\s\S]*?if \(previous !== null && previous\.isConnected\)[\s\S]*?currentCodePath\(\) !== null[\s\S]*?focusWorkspaceFallback\(/,
  );
  assert.match(source, /\}, \[currentCodeEditor, currentCodePath\]\);/);
  assert.match(panel, /onClose=\{closeFindToolWindow\}/);
  assert.doesNotMatch(panel, /onClose=\{\(\) => setFindTool\(null\)\}/);
});
