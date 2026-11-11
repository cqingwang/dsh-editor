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

const readmeInDirectory = load('readmeInDirectory');

test('the shell\'s directory README is found regardless of case', () => {
  /* IDEA's terminal menu opens the project's README; the file is spelled README.md,
     readme.md or Readme.md depending on who created it. */
  assert.equal(readmeInDirectory(['README.md'], ''), 'README.md');
  assert.equal(readmeInDirectory(['readme.md'], ''), 'readme.md');
  assert.equal(readmeInDirectory(['Readme.md'], ''), 'Readme.md');
});

test('the README is resolved relative to the shell directory', () => {
  assert.equal(readmeInDirectory(['README.md'], 'src'), 'src/README.md');
  assert.equal(readmeInDirectory(['README.md'], 'src/deep'), 'src/deep/README.md');
});

test('a directory without a README reports nothing to open', () => {
  /* The menu item must be disabled rather than opening a missing path. */
  assert.equal(readmeInDirectory(['notes.md'], ''), null);
  assert.equal(readmeInDirectory([], 'src'), null);
  assert.equal(readmeInDirectory(null, ''), null);
});

test('the terminal tab menu offers it next to the path actions', () => {
  assert.match(source, /editor\.openReadme/);
  assert.match(source, /readmeInDirectory\(/);
});
