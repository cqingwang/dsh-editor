import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('file navigation expands the group and every directory ancestor of its target', () => {
  const revealCollapseKeys = extractFunction('revealCollapseKeys');
  assert.deepEqual(revealCollapseKeys('unversioned', 'src/nested/file.ts'), [
    'unversioned:',
    'unversioned:src',
    'unversioned:src/nested',
  ]);
  assert.deepEqual(revealCollapseKeys('staged', 'README.md'), ['staged:']);
});

test('Ctrl+Shift file navigation reveals a hidden target before selecting it', () => {
  const start = source.indexOf('const navigateDiffFile = React.useCallback(');
  const end = source.indexOf('const projectName =', start);
  const navigate = source.slice(start, end);
  const reveal = navigate.indexOf('revealChangeRow(next);');
  const select = navigate.indexOf('chooseChange(next, {})');
  assert.ok(reveal >= 0 && select > reveal);
});
