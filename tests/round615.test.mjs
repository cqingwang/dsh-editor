import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findStart = source.indexOf('function FindToolWindow(');
const findEnd = source.indexOf('\n    /**\n     * IDEA\'s "Go to File"', findStart);
const find = source.slice(findStart, findEnd);
const panelStart = source.indexOf('React.createElement(FindToolWindow, {');
const panelClose = 'onClose: closeFindToolWindow,';
const panelEnd = source.indexOf(panelClose, panelStart);
const panel = source.slice(panelStart, panelEnd + panelClose.length);

test('Find tool root owns Escape outside inputs, rows and menus', () => {
  assert.match(
    find,
    /onKeyDown: \(event\) => \{[\s\S]*?event\.key !== 'Escape'[\s\S]*?event\.defaultPrevented[\s\S]*?closest\('\[role="menu"\]'\)[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onClose\(\)/,
  );
  assert.doesNotMatch(find, /document\.body\.focus/);
});

test('replacement Escape cannot double-close through the tool root', () => {
  const replacementStart = find.indexOf("'data-dsh-find-replace-input': ''");
  const replacementEnd = find.indexOf('React.createElement(ToolbarButton', replacementStart);
  const replacement = find.slice(replacementStart, replacementEnd);
  assert.match(
    replacement,
    /event\.key === 'Escape'[\s\S]*?event\.preventDefault\(\)[\s\S]*?event\.stopPropagation\(\)[\s\S]*?onClose\(\)/,
  );
});

test('closing the Find tool returns keyboard ownership to the active editor', () => {
  assert.match(
    source,
    /const closeFindToolWindow = React\.useCallback\(\(\) => \{[\s\S]*?setFindTool\(null\);[\s\S]*?window\.setTimeout\([\s\S]*?currentCodeEditor\(\)\?\.focus\?\.\(\)[\s\S]*?0\);[\s\S]*?\}, \[currentCodeEditor\]\);/,
  );
  assert.match(panel, /onClose: closeFindToolWindow/);
  assert.doesNotMatch(panel, /onClose: \(\) => setFindTool\(null\)/);
});
