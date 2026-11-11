import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance, with the width constants. */
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
      if (depth === 0) {
        const constants = [
          'const CHAT_WIDTH_MIN = 15;',
          'const CHAT_WIDTH_MAX = 45;',
          'const CHAT_WIDTH_DEFAULT = 25;',
        ].join('\n');
        return new Function(`${constants}\n${source.slice(start, index + 1)}; return ${name};`)();
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const clampChatPercent = load('clampChatPercent');

test('the chat column can be dragged within a sane range', () => {
  /* Below ~15% the chat is unusable; past ~45% the editor stops being an editor. */
  assert.equal(clampChatPercent(25), 25);
  assert.equal(clampChatPercent(5), 15);
  assert.equal(clampChatPercent(80), 45);
  assert.equal(clampChatPercent(Number.NaN), 25);
});

test('the split width comes from a CSS variable, so a drag can move it', () => {
  /* Round 82 replaced the hard-coded 25% with one variable read by all three
     layout rules (chat column, composer, editor host). */
  assert.match(source, /--dsh-editor-chat-width/);
  assert.match(source, /width: var\(--dsh-editor-chat-width, 25%\) !important;/);
  assert.match(source, /margin-left: var\(--dsh-editor-chat-offset, 75%\) !important;/);
  assert.match(source, /right: var\(--dsh-editor-chat-width, 25%\);/);
});

test('a drag handle is injected and the width is remembered', () => {
  assert.match(source, /data-dsh-editor-chat-handle/);
  assert.match(source, /dsh-editor\.chatWidth/);
  assert.match(source, /function readChatWidth\(\)/);
  assert.match(source, /function writeChatWidth\(/);
  /* The handle must be removed together with the host. */
  const start = source.indexOf('function destroyHost() {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /chatHandle\?\.remove\(\)|chatHandle\.remove\(\)/);
});
