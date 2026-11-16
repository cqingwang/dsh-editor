import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);
const replaceInFind = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const replaceInSearch = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);
const searchEverywhere = source.slice(
  source.indexOf('function SearchEverywhere('),
  source.indexOf('function ShowUsagesPopup('),
);

test('Cancelling Replace All returns focus to the replacement input', () => {
  for (const replaceBlock of [replaceInFind, replaceInSearch]) {
    const cancelAt = replaceBlock.indexOf('window.confirm');
    const returnAt = replaceBlock.indexOf('return;', cancelAt);
    const cancelBranch = replaceBlock.slice(cancelAt, returnAt);
    assert.match(cancelBranch, /replaceFocusRequest: \(current\.replaceFocusRequest \?\? 0\) \+ 1/u);
  }
});

test('Search Everywhere owns a replacement ref and reacts to focus requests', () => {
  assert.match(searchEverywhere, /const replaceInputRef = React\.useRef\(null\)/u);
  assert.match(searchEverywhere, /ref: replaceInputRef/u);
  assert.match(searchEverywhere, /const replaceFocusRequest = Math\.max\(0, Number\(state\.replaceFocusRequest\) \|\| 0\)/u);
  assert.match(searchEverywhere, /state\.withReplace !== true \|\| replaceFocusRequest === 0/u);
  assert.match(searchEverywhere, /replaceInputRef\.current\?\.focus\?\.\(\)/u);
});

test('New Search Everywhere sessions start with no stale focus request', () => {
  const opener = source.slice(
    source.indexOf('const openSearchEverywhere = React.useCallback'),
    source.indexOf('React.useEffect(() => {\n        openSearchEverywhereRef.current'),
  );
  assert.match(opener, /replaceFocusRequest: 0/u);
});

test('A non-empty zero-result query can still open the persistent Find window', () => {
  assert.match(findTool, /if \(!floating \|\| !hasFindToolContentQuery\(query\)\) return/u);
  assert.match(findTool, /disabled: !hasFindToolContentQuery\(query\)/u);
});
