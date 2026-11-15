import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('legacy chat-collapse state cannot silently hide the chat column', () => {
  /* The old chat-collapse button was replaced by the Editor toggle. Keeping its
     0%-width state would make a previously collapsed profile open Editor with no
     chat column and no control to restore it. */
  assert.doesNotMatch(source, /dsh-editor\.chatCollapsed/);
  assert.doesNotMatch(source, /data-dsh-editor-chat-collapsed/);
  assert.doesNotMatch(source, /function toggleChatCollapsed\(/);
  assert.doesNotMatch(source, /function applyChatCollapsed\(/);
  assert.match(source, /function applyChatLayout\(\)/);
});
