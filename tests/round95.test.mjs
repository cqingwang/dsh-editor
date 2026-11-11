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

const collapsedChatWidth = load('collapsedChatWidth');

test('collapsing the chat gives the editor the whole width', () => {
  /* The variable is the CHAT column's width: 0% hands the whole area to the editor
     (100% was the first attempt and left the editor 1px wide). */
  assert.equal(collapsedChatWidth(0), '0%');
  assert.equal(collapsedChatWidth(25), '25%');
});

test('a collapsed chat remembers the width it will restore', () => {
  const start = source.indexOf('function applyChatCollapsed()');
  assert.notEqual(start, -1, 'applyChatCollapsed is missing');
  const block = source.slice(start, start + 900);
  assert.match(block, /--dsh-editor-chat-width/);
  /* Collapsing must not overwrite the remembered width. */
  assert.match(block, /collapsedChatWidth\(width\)/);
});

test('the toggle lives in the tab strip and is not a tab', () => {
  assert.match(source, /data-dsh-editor-chat-toggle/);
  const start = source.indexOf('function ensureChatToggle(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3400);
  /* A role="tab" would join the View switching and steal the Editor tab's slot. */
  assert.match(block, /data-dsh-editor-chat-toggle/);
  assert.doesNotMatch(block, /role', 'tab'/);
  assert.match(block, /toggleChatCollapsed/);
  /* The label is applied by `applyChatCollapsed`, which the toggle calls. */
  assert.match(source, /chatToggle\.setAttribute\('aria-label', t\(chatCollapsed \? 'editor\.showChat' : 'editor\.hideChat'\)\)/);
});

test('collapsed means the chat column is 0% wide, not 100%', () => {
  /* The variable is the chat column's width. Getting the direction backwards left
     the editor 1px wide while the chat filled the area — caught at runtime. */
  assert.equal(collapsedChatWidth(0), '0%');
  assert.equal(collapsedChatWidth(30), '30%');
});

test('the collapse choice is remembered across reloads', () => {
  assert.match(source, /dsh-editor\.chatCollapsed/);
  const start = source.indexOf('function toggleChatCollapsed()');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /localStorage\.setItem\('dsh-editor\.chatCollapsed'/);
});

test('both chat labels exist in both dictionaries', () => {
  assert.equal(source.split("hideChat: '").length - 1, 2);
  assert.equal(source.split("showChat: '").length - 1, 2);
});
