import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the chat toggle uses a real icon, not a tiny chevron glyph', () => {
  /* `»` rendered as an 11px text glyph: easy to miss and hard to hit. The strip has
     a sprite with a panel icon that says "show/hide a side panel" exactly. */
  const start = source.indexOf('function ensureChatToggle(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 3400);
  assert.match(block, /data-dsh-editor-chat-toggle-icon|svg|use/);
});

test('the toggle is big enough to click comfortably', () => {
  const start = source.indexOf('function ensureChatToggle(');
  const block = source.slice(start, start + 3400);
  const width = /width:(\d+)px/.exec(block);
  const height = /height:(\d+)px/.exec(block);
  assert.notEqual(width, null, 'the toggle needs an explicit width');
  assert.notEqual(height, null, 'the toggle needs an explicit height');
  assert.ok(Number(width[1]) >= 24, `width ${width[1]}px should be at least 24px`);
  assert.ok(Number(height[1]) >= 24, `height ${height[1]}px should be at least 24px`);
});

test('the icon flips with the state, and the label stays localised', () => {
  const start = source.indexOf('function ensureChatToggle(');
  const block = source.slice(start, start + 3400);
  assert.match(block, /applyChatLayout\(\)/);
  assert.match(source, /panel-left-outline-regular/);
  assert.match(source, /panel-right-outline-regular|panel-left-outline-regular/);
});
