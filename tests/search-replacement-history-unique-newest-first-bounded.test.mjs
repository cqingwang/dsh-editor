import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findBarSource = await readFile(
  new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url),
  'utf8',
);

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('replacement history is unique, newest-first and bounded', () => {
  const rememberReplacementHistory = new Function(
    `${extractSource('normalizeReplacementHistoryEntry')};`
      + `${extractSource('rememberReplacementHistory')}; return rememberReplacementHistory;`,
  )();
  assert.deepEqual(rememberReplacementHistory(['old', 'same'], 'same', 3), ['same', 'old']);
  assert.deepEqual(rememberReplacementHistory(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']);
  assert.deepEqual(rememberReplacementHistory(['a'], '   ', 3), ['   ', 'a']);
  assert.deepEqual(rememberReplacementHistory(null, 'x', 3), ['x']);
  assert.deepEqual(rememberReplacementHistory(null, '  x  ', 3), ['  x  ']);
  assert.deepEqual(rememberReplacementHistory(null, '   ', 3), ['   ']);
});

test('query and replacement histories are workspace-scoped', () => {
  assert.match(source, /dsh-editor\.replace\.history:\$\{root\}/);
  assert.match(source, /function readReplaceHistory\(root\)/);
  assert.match(source, /function writeReplaceHistory\(root, history\)/);
  assert.match(source, /rememberWorkspaceSearchQuery\(/);
  assert.match(source, /rememberWorkspaceReplacement\(/);
});

test('Find query and replace fields expose history menus and Alt+ArrowDown', () => {
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findToolWindow, /editor\.findSearchHistory/);
  assert.match(findToolWindow, /editor\.findReplaceHistory/);
  assert.match(findToolWindow, /event\.altKey === true && event\.key === 'ArrowDown'/);
  assert.match(findToolWindow, /React\.createElement\(ContextMenu/);
  assert.match(findToolWindow, /data-dsh-find-history-menu/);
});

test('editor Find fields expose the same history behavior', () => {
  assert.match(findBarSource, /editor\.findSearchHistory/);
  assert.match(findBarSource, /editor\.findReplaceHistory/);
  assert.match(findBarSource, /event\.altKey === true && event\.key === 'ArrowDown'/);
  assert.match(findBarSource, /data-dsh-editor-find-history-menu=''/);
});
