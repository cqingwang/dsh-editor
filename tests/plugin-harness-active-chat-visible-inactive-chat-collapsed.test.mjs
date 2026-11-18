import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');

test('Harness is active when chat is visible and inactive when chat is collapsed', () => {
  assert.match(stripeSource, /active=\{harnessCollapsed !== true\}/);
  assert.doesNotMatch(stripeSource, /active=\{harnessCollapsed\}/);
});

test('The tool-window and terminal width handles paint a visible line at rest', () => {
  const sideResize = source.slice(source.indexOf('      sideResize: {'), source.indexOf('      renameInput: {'));
  const terminalSplit = source.slice(source.indexOf('      terminalSplitHandle: {'), source.indexOf('      terminalPaneFocused: {'));
  assert.match(sideResize, /width: 5/);
  assert.match(sideResize, /linear-gradient\(to right/);
  assert.match(sideResize, /var\(--dsw-alias-border-l3\)/);
  assert.match(terminalSplit, /width: 5/);
  assert.match(terminalSplit, /borderLeft: '1px solid var\(--dsw-alias-border-l3\)'/);
});

test('The chat and dock drag handles expose a thicker resting divider than before', () => {
  assert.match(source, /'\[data-dsh-editor-chat-handle\] \{'[\s\S]*?'  width: 8px;'/);
  assert.match(source, /'\[data-dsh-editor-chat-handle\] \{'[\s\S]*?linear-gradient\(to right, transparent 2px, var\(--dsw-alias-border-l3\) 2px 4px, transparent 4px\)/);
  assert.match(source, /const next = `\$\{Math\.max\(0, left - 4\)\}px`;/);
  const dockResize = source.slice(source.indexOf('      dockResize: {'), source.indexOf('      conflictBar: {'));
  assert.match(dockResize, /height: 6/);
  assert.match(dockResize, /linear-gradient\(to bottom/);
  assert.match(dockResize, /var\(--dsw-alias-border-l3\)/);
});
