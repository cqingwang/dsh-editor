import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

const projectSingleClickPreference = new Function(
  `${extractFunction('projectSingleClickPreference')}; return projectSingleClickPreference;`,
)();

test('legacy Autoscroll to Source state migrates into Open Files with Single Click', () => {
  assert.equal(projectSingleClickPreference('0', '0'), false);
  assert.equal(projectSingleClickPreference('1', '0'), true);
  assert.equal(projectSingleClickPreference('0', '1'), true);
  assert.equal(projectSingleClickPreference('1', '1'), true);
  assert.match(source, /const \[singleClickOpen, setSingleClickOpen\] = React\.useState\(readProjectSingleClickOpen\)/);
});

test('Project Behavior exposes one IDEA AutoscrollToSource action, not two', () => {
  const behavior = source.slice(source.indexOf("id: 'behavior'"), source.indexOf("id: 'appearance'"));
  assert.match(behavior, /id: 'singleClickOpen', label: t\('editor\.openFilesSingleClick'\)/);
  assert.doesNotMatch(behavior, /id: 'autoscrollToSource'/);
  assert.doesNotMatch(source, /const \[autoScrollToSource, setAutoScrollToSource\]/);
  assert.doesNotMatch(source, /const toggleAutoScrollToSource = React\.useCallback/);
  assert.doesNotMatch(source, /projectAutoScrollTarget\(rows, selectedPath\)/);
});

test('the legacy key is consumed only as a migration source', () => {
  assert.match(source, /readStoredText\('dsh-editor\.project\.autoscrollToSource', '0'\)/);
  assert.match(source, /window\.localStorage\.removeItem\('dsh-editor\.project\.autoscrollToSource'\)/);
  assert.doesNotMatch(source, /window\.localStorage\.setItem\('dsh-editor\.project\.autoscrollToSource'/);
});
