import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the layout writes the chat width directly', () => {
  const start = source.indexOf('function applyChatLayout()');
  assert.notEqual(start, -1, 'applyChatLayout is missing');
  const block = source.slice(start, start + 900);
  assert.match(block, /--dsh-editor-chat-width/);
  assert.match(block, /const layoutWidth = chatLayoutWidth\(harnessCollapsed, chatWidth\)/);
  assert.match(block, /`\$\{layoutWidth\}%`/);
  assert.match(block, /--dsh-editor-chat-offset/);
});

test('the Editor toggle lives in the tab strip and is not a tab', () => {
  assert.match(source, /data-dsh-editor-chat-toggle/);
  const start = source.indexOf('function ensureChatToggle(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3400);
  /* A role="tab" would join the View switching and steal the Editor tab's slot. */
  assert.match(block, /data-dsh-editor-chat-toggle/);
  assert.doesNotMatch(block, /role', 'tab'/);
  assert.match(block, /if \(active\) setActive\(false\);/);
  assert.match(block, /else openEditorSplit\(\);/);
  /* The label is applied by `applyChatLayout`, which the toggle calls. */
  assert.match(source, /chatToggle\.setAttribute\('aria-label', t\(active \? 'editor\.closeEditor' : 'editor\.openEditor'\)\)/);
});

test('both chat labels exist in both dictionaries', () => {
  assert.equal(source.split("hideChat: '").length - 1, 2);
  assert.equal(source.split("showChat: '").length - 1, 2);
});
