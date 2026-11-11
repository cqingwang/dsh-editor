import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the composer seat is pinned to the chat column, not to the scroller', () => {
  /* Round 94 made the scroll body `overflow-y: auto`; that turned it into the
     containing block for the composer's `position: sticky; bottom: 0`, and with a
     conversation longer than one screen the input box stuck to the container's TOP
     (measured at y=31, i.e. over the editor) instead of the bottom. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-composer-seat] {',");
  assert.notEqual(start, -1, 'the composer seat needs an explicit rule');
  const block = source.slice(start, start + 400);
  /* `sticky` alone was the bug: with the content overflowing it stuck to the top. */
  assert.match(block, /position: absolute !important;/);
  assert.match(block, /bottom: 0 !important;/);
});

test('the seat keeps the chat column geometry', () => {
  const start = source.indexOf("'[data-dsh-editor-active] [data-composer-seat] {',");
  const block = source.slice(start, start + 600);
  assert.match(block, /width: var\(--dsh-editor-chat-width, 25%\) !important;/);
  assert.match(block, /right: 0 !important;/);
});

test('the outer body stops scrolling so the composer keeps its anchor', () => {
  /* The body is `position: relative`; a scroll container there becomes the
     containing block for the composer and drags it to the top. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 400);
  assert.match(block, /overflow: hidden !important;/);
  assert.doesNotMatch(block, /overflow-y: auto/);
});

test('the View area carries the scrolling instead', () => {
  /* The View area is the element with the height; the outer body must not scroll. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] .kiGsTW_viewArea {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 400);
  assert.match(block, /overflow: auto !important;/);
  assert.match(block, /overflow-y: auto !important;/);
});

test('no rule re-hides the View area\'s overflow', () => {
  /* A `[data-slot="conversation.session"] > div { overflow: hidden !important }`
     silently beat the View area rule (both !important, later wins) and left nothing
     scrollable until it was removed. */
  const start = source.indexOf("'[data-dsh-editor-active] [data-conversation-scroll] [data-slot=\"conversation.session\"] > div {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 220);
  assert.doesNotMatch(block, /overflow/);
});
