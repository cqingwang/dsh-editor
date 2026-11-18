import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source = [
  workspaceSource,
  await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/controller.ts', import.meta.url), 'utf8'),
].join('\n');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/client/components/ui/Icon.tsx', import.meta.url), 'utf8');

test('Harness follows Project, Commit and Terminal in the activity stripe', () => {
  const ids = [...stripeSource.matchAll(/id='(project|commit|terminal|harness)'/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['project', 'commit', 'terminal', 'harness']);
  assert.match(stripeSource, /label=\{t\('editor\.harness'\)\}/);
  assert.match(stripeSource, /icon='harness'/);
  assert.match(stripeSource, /active=\{harnessCollapsed !== true\}/);
  assert.match(stripeSource, /onClick=\{onToggleHarness\}/);
  assert.match(iconSource, /case 'harness':/);
});

test('Editor workspace reflects the Harness collapse state returned by the layout controller', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /initialHarnessCollapsed = false/);
  assert.match(workspace, /onToggleHarness/);
  assert.match(workspace, /const \[harnessCollapsed, setHarnessCollapsed\] = React\.useState\(initialHarnessCollapsed === true\);/);
  assert.match(workspace, /const next = onToggleHarness\?\.\(\)/);
  assert.match(workspace, /if \(typeof next === 'boolean'\) setHarnessCollapsed\(next\)/);
  assert.match(workspace, /harnessCollapsed,/);
  assert.match(workspace, /onToggleHarness=\{toggleHarness\}/);
});

test('Harness collapse uses 0% without overwriting the saved chat width', () => {
  const layout = source.slice(source.indexOf('function applyChatLayout()'), source.indexOf('function matchTabMetrics('));
  assert.match(layout, /const layoutWidth = chatLayoutWidth\(harnessCollapsed, chatWidth\)/);
  assert.match(layout, /--dsh-editor-chat-width/);
  assert.match(layout, /--dsh-editor-chat-offset/);
  assert.match(layout, /data-dsh-editor-harness-collapsed/);
  const clampChatPercent = new Function(
    'CHAT_WIDTH_MIN',
    'CHAT_WIDTH_MAX',
    'CHAT_WIDTH_DEFAULT',
    `${transpileTypeScriptFunction(workspaceSource, 'clampChatPercent')}; return clampChatPercent;`,
  )(28, 44, 35);
  const width = (collapsed, value) => (collapsed === true ? 0 : clampChatPercent(value));
  assert.equal(width(true, 35), 0);
  assert.equal(width(false, 35), 35);
  assert.equal(width(false, Number.NaN), 35);
});

test('collapsed Harness removes the chat surfaces from the editor layout', () => {
  assert.match(source, /\[data-dsh-editor-harness-collapsed\] \[data-dsh-editor-active\] \[data-conversation-scroll\] \[data-slot="conversation\.session"\][\s\S]*?display: none !important;/);
  assert.match(source, /\[data-dsh-editor-harness-collapsed\] \[data-dsh-editor-active\] \[data-composer-seat\][\s\S]*?display: none !important;/);
  assert.match(source, /\[data-dsh-editor-harness-collapsed\] \[data-dsh-editor-active\] \[data-dsh-editor-chat-handle\][\s\S]*?display: none !important;/);
});

test('Harness toggle text exists in both dictionaries', () => {
  for (const key of ['harness', 'hideHarness', 'showHarness']) {
    assert.ok(source.split(`${key}:`).length - 1 >= 2, `${key} must exist in both dictionaries`);
  }
});
