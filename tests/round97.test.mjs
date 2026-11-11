import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('a collapsed chat marks the editor as maximized', () => {
  /* IDEA frames the maximized tool window; without a cue the missing divider looks
     like a rendering bug rather than a deliberate state. */
  const start = source.indexOf('function applyChatCollapsed()');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1200);
  assert.match(block, /data-dsh-editor-chat-collapsed/);
  const css = source.indexOf("'[data-dsh-editor-chat-collapsed] [data-dsh-editor-host] {',");
  assert.notEqual(css, -1, 'the maximized cue needs a rule');
  const rule = source.slice(css, css + 400);
  assert.match(rule, /border-right/);
});

test('the cue disappears the moment the chat comes back', () => {
  const start = source.indexOf('function applyChatCollapsed()');
  const block = source.slice(start, start + 1200);
  assert.match(block, /removeAttribute\('data-dsh-editor-chat-collapsed'\)/);
});
