import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

test('Harness follows Project, Commit and Terminal in the activity stripe', () => {
  const stripe = source.slice(source.indexOf('function ActivityStripe('), source.indexOf('/**\n     * IDEA-style tool-window toolbar'));
  const ids = [...stripe.matchAll(/id: '(project|commit|terminal|harness)'/g)].map((match) => match[1]);
  assert.deepEqual(ids, ['project', 'commit', 'terminal', 'harness']);
  assert.match(stripe, /label: t\('editor\.harness'\)/);
  assert.match(stripe, /icon: 'harness'/);
  assert.match(stripe, /active: harnessCollapsed/);
  assert.match(stripe, /onClick: onToggleHarness/);
  assert.match(source, /case 'harness':/);
});

test('Editor workspace reflects the Harness collapse state returned by the layout controller', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /initialHarnessCollapsed = false/);
  assert.match(workspace, /onToggleHarness/);
  assert.match(workspace, /const \[harnessCollapsed, setHarnessCollapsed\] = React\.useState\(initialHarnessCollapsed === true\)/);
  assert.match(workspace, /const next = onToggleHarness\?\.\(\)/);
  assert.match(workspace, /if \(typeof next === 'boolean'\) setHarnessCollapsed\(next\)/);
  assert.match(workspace, /harnessCollapsed,/);
  assert.match(workspace, /onToggleHarness: toggleHarness/);
});

test('Harness collapse uses 0% without overwriting the saved chat width', () => {
  const layout = source.slice(source.indexOf('function applyChatLayout()'), source.indexOf('function matchTabMetrics('));
  assert.match(layout, /const layoutWidth = chatLayoutWidth\(harnessCollapsed, chatWidth\)/);
  assert.match(layout, /--dsh-editor-chat-width/);
  assert.match(layout, /--dsh-editor-chat-offset/);
  assert.match(layout, /data-dsh-editor-harness-collapsed/);
  const width = new Function(
    `const CHAT_WIDTH_MIN = 28; const CHAT_WIDTH_MAX = 44; const CHAT_WIDTH_DEFAULT = 35;\n${extract('clampChatPercent')}\n${extract('chatLayoutWidth')}\nreturn chatLayoutWidth;`,
  )();
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
