import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name, extra = '') {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${extra}${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const shellQuote = load('shellQuote');

test('a path with spaces is quoted for the terminal, IDEA\'s "copy path" does the same', () => {
  assert.equal(shellQuote('/tmp/plain'), '/tmp/plain');
  assert.equal(shellQuote('/tmp/with space'), "'/tmp/with space'");
  assert.equal(shellQuote("/tmp/it's"), `'/tmp/it'\\''s'`);
  assert.equal(shellQuote(''), "''");
});

test('the tree menu offers "copy path" next to the relative one', () => {
  const start = source.indexOf('const buildTreeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  /* Bounded by the NEXT callback, not by a character count: a comment added
     inside this menu used to push the assertions past the slice. */
  const block = source.slice(start, source.indexOf('}, [projectName, selection]);', start));
  assert.match(block, /t\('editor\.copyAbsolutePath'\)/);
  assert.match(block, /shellQuote\(/);
});

test('both dictionaries carry the label', () => {
  assert.equal(source.split('copyAbsolutePath:').length - 1, 2);
});
