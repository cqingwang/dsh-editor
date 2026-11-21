import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);
const searchRow = findTool.slice(
  findTool.indexOf('styles.findToolPopupSearchRow'),
  findTool.indexOf('{replaceExpanded ? (', findTool.indexOf('styles.findToolPopupSearchRow')),
);
const replaceRow = findTool.slice(
  findTool.indexOf('styles.findToolReplaceRow'),
  findTool.indexOf('styles.findToolScopeRow', findTool.indexOf('styles.findToolReplaceRow')),
);

test('The transient Find in Files popup exposes Search New Line', () => {
  assert.match(searchRow, /\{searchNewLineControl\}/);
  const control = findTool.slice(
    findTool.indexOf('const searchNewLineControl ='),
    findTool.indexOf('const tabItems =', findTool.indexOf('const searchNewLineControl =')),
  );
  assert.match(control, /checked=\{searchNewLine\}/);
  assert.match(control, /findNewLine/);
  assert.equal((control.match(/data-dsh-find-search-new-line/g) ?? []).length, 1);
});

test('The transient Replace row exposes an independent Replace New Line', () => {
  assert.match(replaceRow, /checked=\{replaceNewLine\}/);
  assert.match(replaceRow, /findNewLine/);
  assert.match(replaceRow, /data-dsh-find-replace-new-line/);
  assert.doesNotMatch(replaceRow, /floating === false/);
});

test('New Line changes inputs to textareas without consuming action shortcuts', () => {
  assert.match(findTool, /const QueryField = searchNewLine \? 'textarea' : 'input';/);
  assert.match(findTool, /const ReplaceField = replaceNewLine \? 'textarea' : 'input';/);
  assert.match(
    findTool,
    /searchNewLine && event\.key === 'Enter' && event\.metaKey !== true && event\.ctrlKey !== true/,
  );
  assert.match(
    findTool,
    /replaceNewLine[\s\S]*?event\.key === 'Enter'[\s\S]*?!\(event\.altKey === true && event\.shiftKey === true\)/,
  );
  assert.match(findTool, /replaceInputAction\(event, 'single'\)/);
});
