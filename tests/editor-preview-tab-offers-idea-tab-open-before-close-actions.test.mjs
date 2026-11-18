import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function fileTabs() {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  return workspace.slice(workspace.indexOf('const tabs = openFiles.map((file) => {'), workspace.indexOf("/**\n       * The diff's own editor tab"));
}

test('a preview tab offers IDEA Keep Tab Open before the close actions', () => {
  const tabs = fileTabs();
  const keep = tabs.indexOf("id: 'keepTabOpen'");
  const close = tabs.indexOf("id: 'close'");
  assert.ok(keep >= 0 && close > keep);
  assert.match(tabs, /\.\.\.\(preview\s+\? \[/);
  assert.match(tabs, /label: t\('editor\.keepTabOpen'\)/);
  assert.match(tabs, /previewPathRef\.current = null;\s+setPreviewPath\(null\);/);
});

test('Keep Tab Open is available only for the active preview tab', () => {
  const tabs = fileTabs();
  const menuStart = tabs.indexOf('items: [', tabs.indexOf('onContextMenu'));
  const keep = tabs.slice(menuStart, tabs.indexOf("id: 'close'", menuStart));
  assert.match(keep, /run: \(\) => \{/);
  assert.match(keep, /if \(previewPathRef\.current === file\.path\)/);
  assert.doesNotMatch(keep, /disabled:/);
});

test('Keep Tab Open wording matches IDEA resources', () => {
  assert.ok(source.includes("keepTabOpen: '保持标签页打开'"));
  assert.ok(source.includes("keepTabOpen: 'Keep Tab Open'"));
});
