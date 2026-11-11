import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const pathWithLine = load('pathWithLine');

test('a file nobody opened copies its plain path, not ":1:1"', () => {
  /* The caret belongs to the file open in the editor; using it for any other row
     produced `notes.md:1:1`, which points at a line the user never chose. */
  assert.equal(pathWithLine('notes.md', null, false), 'notes.md');
  assert.equal(pathWithLine('src/a.ts', { lineNumber: 1, column: 1 }, false), 'src/a.ts');
});

test('the open file copies the caret position, as IDEA does', () => {
  assert.equal(pathWithLine('src/a.ts', { lineNumber: 12, column: 5 }, true), 'src/a.ts:12:5');
  assert.equal(pathWithLine('src/a.ts', { lineNumber: 1, column: 1 }, true), 'src/a.ts:1:1');
});

test('a missing caret still falls back to the path', () => {
  assert.equal(pathWithLine('src/a.ts', null, true), 'src/a.ts');
  assert.equal(pathWithLine('src/a.ts', undefined, true), 'src/a.ts');
  assert.equal(pathWithLine('', null, true), '');
});
