import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/client/components/ui/Icon.tsx', import.meta.url), 'utf8');

test('Harness exposes an icon-only Editor close utility while chat is collapsed', () => {
  assert.match(stripeSource, /onCloseEditor/);
  assert.match(stripeSource, /harnessCollapsed \? \(?\s*<button/);
  assert.match(stripeSource, /className='dsh-editor-stripe-item dsh-editor-stripe-close'/);
  assert.match(stripeSource, /title=\{t\('editor\.closeEditor'\)\}/);
  assert.match(stripeSource, /aria-label=\{t\('editor\.closeEditor'\)\}/);
  assert.match(stripeSource, /<Icon[\s\S]{0,80}?name='close'[\s\S]{0,40}?size=\{16\}/);
});

test('the close utility uses the existing controller close path', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /onCloseEditor/);
  assert.match(workspace, /onCloseEditor,/);
  assert.match(source, /onToggleHarness: toggleHarnessLayout,\s*onCloseEditor: \(\) => setActive\(false\),/s);
});

test('the activity stripe close glyph is a real icon and has a pinned utility style', () => {
  assert.match(iconSource, /case 'close':[\s\S]*?M4 4l8 8[\s\S]*?M12 4 4 12/);
  assert.match(source, /stripeUtilityItem:\s*\{[\s\S]*?marginTop: 'auto'/);
});
