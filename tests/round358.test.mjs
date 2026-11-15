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

test('AutoscrollToSource legacy state maps to the unified single-click preference', () => {
  assert.equal(projectSingleClickPreference('0', '0'), false);
  assert.equal(projectSingleClickPreference('1', '0'), true);
  assert.equal(projectSingleClickPreference('0', '1'), true);
});

test('Project exposes IDEA AutoscrollToSource as Open Files with Single Click', () => {
  assert.match(source, /const \[singleClickOpen, setSingleClickOpen\] = React\.useState\(readProjectSingleClickOpen\)/);
  assert.match(source, /const toggleSingleClickOpen = React\.useCallback\(/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.project\.singleClickOpen', next \? '1' : '0'\)/);
  assert.match(source, /\{ id: 'singleClickOpen', label: t\('editor\.openFilesSingleClick'\), shortcut: singleClickOpen \? '✓' : ''/);
  assert.doesNotMatch(source, /id: 'autoscrollToSource'/);
});

test('the IDEA UI wording exists in both dictionaries', () => {
  assert.ok(source.includes("openFilesSingleClick: '单击打开文件'"));
  assert.ok(source.includes("openFilesSingleClick: 'Open Files with Single Click'"));
});
