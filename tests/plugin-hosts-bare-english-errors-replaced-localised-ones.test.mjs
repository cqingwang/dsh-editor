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

const hostErrorText = load('hostErrorText');

test('the host\'s bare English errors are replaced with localised ones', () => {
  /* `revealInFileManager` throws `path does not exist`, which reached a zh UI
     verbatim as "path does not exist". */
  const resolve = (key, params) => `${key}${params === undefined ? '' : JSON.stringify(params)}`;
  assert.equal(
    hostErrorText('path does not exist', resolve, '/tmp/gone'),
    'editor.pathMissing{"path":"/tmp/gone"}',
  );
  assert.equal(
    hostErrorText('path escapes the workspace', resolve, 'x'),
    'editor.pathOutsideWorkspace',
  );
});

test('an unknown error is passed through untouched', () => {
  /* A git failure already carries its own context; rewriting it would lose it. */
  const resolve = (key) => key;
  assert.equal(hostErrorText('fatal: not a git repository', resolve, 'x'), 'fatal: not a git repository');
  assert.equal(hostErrorText('', resolve, 'x'), '');
  assert.equal(hostErrorText(null, resolve, 'x'), '');
});

test('the reveal path reports the localised message', () => {
  const start = source.indexOf('const revealTerminalDirectory = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1400);
  assert.match(block, /hostErrorText\(/);
});
