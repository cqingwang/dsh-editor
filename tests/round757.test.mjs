import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

test('active editor tabs do not auto-reveal themselves in the Project tree', () => {
  assert.doesNotMatch(client, /const \[autoScroll, setAutoScroll\] = React\.useState/u);
  assert.doesNotMatch(client, /projectAutoScrollArmedRef/u);
  assert.doesNotMatch(client, /suppressAutoScrollRef/u);
  assert.doesNotMatch(client, /if \(!autoScroll \|\| !panelVisible \|\| activity !== 'project'\) return;/u);
  assert.doesNotMatch(client, /const toggleAutoScroll = React\.useCallback/u);
});

test('Select Opened File remains the only active-tab tree locator', () => {
  const editor = client.slice(client.indexOf('function EditorWorkspace('));
  const revealCalls = editor.match(/await revealInProjectTree\(/g) ?? [];
  assert.equal(revealCalls.length, 1);
  assert.match(editor, /const revealActive = React\.useCallback\(async \(\) =>/u);
  assert.match(editor, /await revealPath\(path\)/u);
  assert.match(editor, /onReveal: revealActive/u);
  assert.match(client, /id: 'reveal',[\s\S]*?icon: 'target'[\s\S]*?onClick: onReveal/u);
});

test('Project Behavior no longer exposes an automatic follow preference', () => {
  const options = client.slice(
    client.indexOf('onOpenOptions: (event) => {'),
    client.indexOf('onCreateChange: (value) =>'),
  );
  assert.doesNotMatch(options, /id: 'autoscroll'/u);
  assert.doesNotMatch(options, /toggleAutoScroll/u);
});

test('README describes explicit Select Opened File instead of auto-follow', () => {
  assert.doesNotMatch(readme, /始终选择打开的文件|Always Select Opened File|Always select opened file/u);
  assert.match(readme, /Select Opened File \(⌥F1, 1\)/u);
  assert.match(readme, /不会再自动展开、选中或滚动 Project 树/u);
});
