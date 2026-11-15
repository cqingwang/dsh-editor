import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Harness exposes an icon-only Editor close utility while chat is collapsed', () => {
  const stripe = source.slice(source.indexOf('function ActivityStripe('), source.indexOf('/**\n     * IDEA-style tool-window toolbar'));
  assert.match(stripe, /onCloseEditor/);
  assert.match(stripe, /harnessCollapsed\s*\?\s*React\.createElement\(\s*'button'/);
  assert.match(stripe, /className: 'dsh-editor-stripe-item dsh-editor-stripe-close'/);
  assert.match(stripe, /title: t\('editor\.closeEditor'\)/);
  assert.match(stripe, /'aria-label': t\('editor\.closeEditor'\)/);
  assert.match(stripe, /React\.createElement\(Icon, \{ name: 'close', size: 16 \}\)/);
});

test('the close utility uses the existing controller close path', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /onCloseEditor/);
  assert.match(workspace, /onCloseEditor,/);
  assert.match(source, /onToggleHarness: toggleHarnessLayout,\s*onCloseEditor: \(\) => setActive\(false\),/s);
});

test('the activity stripe close glyph is a real icon and has a pinned utility style', () => {
  assert.match(source, /case 'close':[\s\S]*?M4 4l8 8[\s\S]*?M12 4 4 12/);
  assert.match(source, /stripeUtilityItem:\s*\{[\s\S]*?marginTop: 'auto'/);
});
