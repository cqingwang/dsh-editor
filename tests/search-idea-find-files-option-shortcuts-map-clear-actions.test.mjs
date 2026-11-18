import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('IDEA Find in Files option shortcuts map to clear actions', () => {
  const action = new Function(
    `${extractFunction('findSearchOptionShortcutAction')}; return findSearchOptionShortcutAction;`,
  )();
  assert.equal(action({ key: 'Backspace', altKey: true, shiftKey: true }), 'clear');
  assert.equal(action({ key: 'c', ctrlKey: true }), 'case');
  assert.equal(action({ key: 'w', ctrlKey: true }), 'words');
  assert.equal(action({ key: 'x', ctrlKey: true }), 'regex');
  assert.equal(action({ key: 'c', metaKey: true, ctrlKey: true }), null);
  assert.equal(action({ key: 'Backspace', altKey: true }), null);
  assert.equal(action({ key: 'c', ctrlKey: true, shiftKey: true }), null);
});

test('Find in Files reuses the shared active-option model', () => {
  assert.match(findTool, /const activeFindSearchOptionIds = searchEverywhereActiveOptionIds\(\{/);
  assert.match(findTool, /caseSensitive: state\.caseSensitive === true/);
  assert.match(findTool, /wholeWords: state\.wholeWords === true/);
  assert.match(findTool, /regex: state\.regex === true/);
  assert.match(findTool, /fileMask: state\.fileMask/);
});

test('empty Find results advertise used options and a clear affordance', () => {
  assert.match(findTool, /data-dsh-find-used-options/);
  assert.match(findTool, /searchOptionUsed/);
  assert.match(findTool, /searchOptionsUsed/);
  assert.match(findTool, /searchClearOption/);
  assert.match(findTool, /searchClearAllOptions/);
  assert.match(findTool, /state\.loading !== true/);
  assert.match(findTool, /occurrences\.length === 0/);
  assert.match(findTool, /activeFindSearchOptionIds\.length > 0/);
});

test('Clear options resets only search filters and keeps scope and replacement', () => {
  const start = findTool.indexOf('const clearFindSearchOptions =');
  const end = findTool.indexOf('};', start) + 2;
  const clear = findTool.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(clear, /state\.caseSensitive === true[\s\S]*?onToggleCaseSensitive\(\)/);
  assert.match(clear, /state\.wholeWords === true[\s\S]*?onToggleWholeWords\(\)/);
  assert.match(clear, /state\.regex === true[\s\S]*?onToggleRegex\(\)/);
  assert.match(clear, /setFileMaskEnabled\(false\)/);
  assert.match(clear, /onFileMaskChange\(''\)/);
  assert.doesNotMatch(clear, /onQuery|scopePreset|scopeMode|onTogglePreserveCase|onReplace/);
  assert.match(clear, /queryInputRef\.current\?\.focus/);
});

test('Find option shortcuts are visible and wired only with an idle query caret', () => {
  assert.match(findTool, /searchMatchCase[^\n]*⌃C|⌃C[^\n]*searchMatchCase/);
  assert.match(findTool, /searchWholeWords[^\n]*⌃W|⌃W[^\n]*searchWholeWords/);
  assert.match(findTool, /searchRegex[^\n]*⌃X|⌃X[^\n]*searchRegex/);
  assert.match(findTool, /'aria-keyshortcuts': 'Alt\+Shift\+Backspace'/);
  assert.match(findTool, /findSearchOptionShortcutAction\(event\)/);
  assert.match(findTool, /editable\.selectionStart === editable\.selectionEnd/);
  assert.match(findTool, /closest\('\[data-dsh-find-tool-window\]'\)/);
  assert.match(findTool, /clearFindSearchOptions\(action === 'clear' \? 'all' : action\)/);
});

test('Find empty-state copy is localized in both dictionaries', () => {
  assert.equal((source.match(/findToolNothingFound:/g) ?? []).length, 2);
  assert.equal((source.match(/searchOptionUsed:/g) ?? []).length, 2);
  assert.equal((source.match(/searchClearOption:/g) ?? []).length, 2);
});
