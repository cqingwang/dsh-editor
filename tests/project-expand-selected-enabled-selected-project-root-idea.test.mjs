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
  assert.fail(`${name} has no closing brace`);
}

const projectCanExpandSelection = new Function(
  `${extractFunction('projectCanExpandSelection')}; return projectCanExpandSelection;`,
)();

test('Expand Selected is enabled for a selected Project root, as IDEA does', () => {
  const rows = [
    { path: '', kind: 'directory', root: true },
    { path: 'src', kind: 'directory' },
    { path: 'src/app.ts', kind: 'file' },
  ];
  assert.equal(projectCanExpandSelection(rows, new Set()), false);
  assert.equal(projectCanExpandSelection(rows, new Set(['src/app.ts'])), false);
  assert.equal(projectCanExpandSelection(rows, new Set([''])), true);
  assert.equal(projectCanExpandSelection(rows, new Set(['', 'src/app.ts'])), true);
  assert.equal(projectCanExpandSelection(rows, new Set(['src'])), true);
});

test('the existing recursive action already accepts the root path', () => {
  const action = source.slice(
    source.indexOf('const expandSelectedTree = React.useCallback('),
    source.indexOf('/* Expand every directory under the root', source.indexOf('const expandSelectedTree = React.useCallback(')),
  );
  assert.match(action, /row\?\.kind === 'directory' \? \['', \.\.\.ancestorsOf\(path\), path\] : \[\]/);
});
