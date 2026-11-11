import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('dragging the chat divider shows the live percentage', () => {
  /* Without a readout the drag is guesswork: the column jumps between 15% and 45%
     and the only feedback is the layout reflowing. */
  const start = source.indexOf('function ensureChatHandle(container) {');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3000);
  assert.match(block, /data-dsh-editor-chat-badge/);
  assert.match(block, /container\.appendChild\(badge\)/);
});

test('the badge follows the pointer and disappears when the drag ends', () => {
  const start = source.indexOf('function ensureChatHandle(container) {');
  const block = source.slice(start, start + 3400);
  assert.match(block, /badge\.textContent = `\$\{Math\.round\(chatWidth\)\}%`/);
  /* A stale badge left behind would float over the chat forever. */
  assert.match(block, /badge\.remove\(\)|chatBadge = null/);
});

test('the badge shows the clamped value, not the raw pointer delta', () => {
  const start = source.indexOf('function ensureChatHandle(container) {');
  const block = source.slice(start, start + 3400);
  /* `applyChatWidth` clamps, so reading `chatWidth` after it is the honest number. */
  assert.match(block, /applyChatWidth\(startWidth \+ delta\);/);
  assert.match(block, /Math\.round\(chatWidth\)/);
});
