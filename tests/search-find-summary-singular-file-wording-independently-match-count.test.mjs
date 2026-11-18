import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('Find summary uses singular file wording independently of match count', () => {
  const helper = new Function(
    `${extractFunction('findToolResultSummary')}; return findToolResultSummary;`,
  )();
  const t = (key, params = {}) => `${key}:${params.matches ?? ''}:${params.files ?? ''}`;
  assert.equal(helper(t, 1, 1), 'editor.findToolSummaryOne::');
  assert.equal(helper(t, 2, 1), 'editor.findToolSummaryOneFile:2:');
  assert.equal(helper(t, 2, 2), 'editor.findToolSummary:2:2');
});

test('Both Find status and visible count use the shared summary helper', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.equal((findTool.match(/findToolResultSummary\(/g) ?? []).length, 2);
  assert.match(source, /findToolSummaryOneFile: '\{matches\} 处匹配，1 个文件'/);
  assert.match(source, /findToolSummaryOneFile: '\{matches\} matches in 1 file'/);
});

test('Replace All success preserves query and replacement while clearing results', () => {
  const replaceAll = source.slice(
    source.indexOf('const replaceInFindTool = React.useCallback'),
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  );
  const successState = replaceAll.slice(
    replaceAll.lastIndexOf('setFindTool((current) => (current === null'),
    replaceAll.lastIndexOf('} catch (failure)'),
  );
  assert.match(successState, /matches: \[\]/);
  assert.match(successState, /files: \[\]/);
  assert.match(successState, /replaceBusy: false/);
  assert.match(successState, /error: null/);
  assert.match(successState, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
  assert.match(successState, /loadedGeneration: -1/);
  assert.doesNotMatch(successState, /query: ''/);
  assert.doesNotMatch(successState, /replace: ''/);
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
