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

const cwdFromOsc7 = load('cwdFromOsc7');

test('a file URL from OSC 7 becomes a plain absolute path', () => {
  /* Shells report the working directory with `OSC 7 ; file://host/path ST`. The
     terminal menu needs the PATH, not the URL, and percent-escapes must be undone
     (a directory named "my project" arrives as my%20project). */
  assert.equal(cwdFromOsc7('file://host/Users/chan/project'), '/Users/chan/project');
  assert.equal(cwdFromOsc7('file:///Users/chan/project'), '/Users/chan/project');
  assert.equal(cwdFromOsc7('file://host/Users/chan/my%20project'), '/Users/chan/my project');
  assert.equal(cwdFromOsc7('file://host/Users/chan/a%2Bb'), '/Users/chan/a+b');
});

test('anything that is not a file URL is ignored', () => {
  /* A shell that never sets OSC 7 must not blank the recorded cwd. */
  assert.equal(cwdFromOsc7(''), null);
  assert.equal(cwdFromOsc7('http://example.com/x'), null);
  assert.equal(cwdFromOsc7('file://host'), null);
  assert.equal(cwdFromOsc7(null), null);
});

test('the emulator registers the OSC 7 handler and reports the directory', () => {
  assert.match(source, /registerOscHandler\(7,/);
  /* A missing method must not take the emulator mount down. */
  assert.match(source, /typeof emulator\.parser\?\.registerOscHandler === 'function'/);
  assert.match(source, /cwdFromOsc7\(/);
  assert.match(source, /onCwd/);
});
