import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the chat column gets a real height chain, so its scroller can scroll', () => {
  /* The session slot measured 0px tall in editor mode: the chat body had no height,
     its content overflowed visibly, and the wheel landed on the outer container
     (which is `pointer-events: none`). Every wrapper in the chain needs a height. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1800);
  assert.match(block, /\[data-slot="conversation\.session"\]/);
  assert.match(block, /height: 100% !important;/);
});

test('the wheel reaches the chat column instead of the editor host', () => {
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] [data-slot=\"conversation.session\"] *',");
  assert.notEqual(start, -1, 'the chat subtree must re-enable pointer events');
  /* The outer container stays transparent; everything inside the chat column receives events. */
  assert.match(source.slice(start, start + 500), /pointer-events: auto !important;/);
});

test('the scroll body itself becomes scrollable, not just the wrappers', () => {
  /* Round 94 put the scrolling on the outer body; round 102 moved it to the message
     column (the body's `position: relative` dragged the composer to the top). Both
     states are covered here so neither regresses into "nothing scrolls". */
  assert.match(source, /overflow-y: auto !important;/);
  const area = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] .kiGsTW_viewArea {',");
  assert.notEqual(area, -1, 'the View area must be the scroller');
  assert.match(source.slice(area, area + 400), /overflow: auto !important;/);
});

test('the scroll body stays transparent so the editor keeps its clicks', () => {
  /* Fixing the scroll turned the body into `pointer-events: auto` over the WHOLE
     conversation area (1218px, of which the editor owns 915px): every click on the
     file tree and the code editor hit the chat scroller instead. */
  /* Round 102 moved the scrolling to the message column; the OUTER body must stay
     transparent to the pointer, or it swallows editor and tree clicks. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 400);
  assert.match(block, /overflow: hidden !important;/);
  assert.match(block, /pointer-events: none !important;/);
  /* ...while the chat column itself still receives the wheel. */
  const column = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] [data-slot=\"conversation.session\"] *',");
  assert.notEqual(column, -1, 'the chat subtree must re-enable pointer events');
  assert.match(source.slice(column, column + 500), /pointer-events: auto !important;/);
});
