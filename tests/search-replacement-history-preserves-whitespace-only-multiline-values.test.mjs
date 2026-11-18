import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Replacement history preserves whitespace-only and multiline values', () => {
  const functions = new Function(
    `${extractFunction('normalizeReplacementHistoryEntry')};`
      + `${extractFunction('rememberReplacementHistory')};`
      + 'return { normalizeReplacementHistoryEntry, rememberReplacementHistory };',
  )();
  assert.equal(functions.normalizeReplacementHistoryEntry(' \n '), ' \n ');
  assert.equal(functions.normalizeReplacementHistoryEntry('\n'), '\n');
  assert.equal(functions.normalizeReplacementHistoryEntry(''), '');
  assert.deepEqual(functions.rememberReplacementHistory(['old'], ' \n ', 20), [' \n ', 'old']);
  assert.deepEqual(
    functions.rememberReplacementHistory(['a', ' \n ', 'b'], '\n', 20),
    ['\n', 'a', ' \n ', 'b'],
  );
  assert.deepEqual(functions.rememberReplacementHistory(['a', 'b', 'c'], 'd', 2), ['d', 'a']);
});

test('An empty replacement remains available as a real deletion history entry', () => {
  const workspaceRecorder = extractFunction('rememberWorkspaceReplacement');
  assert.match(workspaceRecorder, /typeof replacement !== 'string'/);
  assert.doesNotMatch(workspaceRecorder, /replacement === ''/);
  assert.doesNotMatch(workspaceRecorder, /replacement\.trim\(\)/);
  assert.match(source, /function replaceHistoryStorageKey\(root\)/);
  assert.match(source, /dsh-editor\.replace\.history:\$\{root\}/);
});

test('Every successful replacement path records the exact replacement', () => {
  const findReplace = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const replaceOne = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(findReplace, /rememberCurrentReplacement\(findTool\.replace\)/);
  assert.match(replaceOne, /rememberCurrentReplacement\(findTool\.replace\)/);
  assert.match(source, /const rememberCurrentReplacement = React\.useCallback\(\(replacement\) => \{[\s\S]*?rememberWorkspaceReplacement\(rootRef\.current, replacement\)/);
});

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
