import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

test('the Editor root is owned by the stable conversation layout parent', () => {
  const findParent = block('const findHostParent = () => {', '/**\n       * Collapse the left workspace');
  assert.match(findParent, /findConversationSlot\(\)/);
  assert.match(findParent, /getComputedStyle\(candidate\)/);
  assert.match(findParent, /display !== 'contents'/);

  const ensureHost = block('function ensureHost(body) {', '/**\n       * Hide the editor without unmounting it');
  assert.match(ensureHost, /const hostParent = findHostParent\(\);/);
  assert.match(ensureHost, /if \(hostParent !== null && host\.parentElement !== hostParent\)/);
  assert.match(ensureHost, /hostParent\.appendChild\(host\)/);
  assert.doesNotMatch(ensureHost, /body\.appendChild\(host\)/);
  assert.doesNotMatch(ensureHost, /body\.querySelectorAll\('\[data-dsh-editor-host\]'\)/);
});

test('the stable Editor surface is geometrically aligned to the live chat body', () => {
  assert.match(source, /function positionEditorHost\(body\)/);
  assert.match(source, /getBoundingClientRect\(\)/);
  assert.match(source, /rect\.width \* \(1 - chatLayoutWidth\(harnessCollapsed, chatWidth\) \/ 100\)/);
  assert.match(source, /host\.style\.left = `\$\{rect\.left\}px`/);
  assert.match(source, /host\.style\.top = `\$\{rect\.top\}px`/);
  assert.match(source, /host\.style\.width = `\$\{width\}px`/);
  assert.match(source, /host\.style\.height = `\$\{rect\.height\}px`/);
  assert.match(source, /new ResizeObserver\(\(\) => positionEditorHost\(body\)\)/);
  assert.match(source, /'  position: fixed;',/);
});

test('the chat body keeps only chat chrome and layout responsibility', () => {
  const setActive = block('function setActive(next) {', '/**\n       * Reconcile the injected DOM');
  assert.match(setActive, /body\.setAttribute\('data-dsh-editor-active', ''\)/);
  assert.match(setActive, /ensureChatHandle\(body\)/);
  assert.match(setActive, /detachChatChrome\(body\)/);
  assert.doesNotMatch(setActive, /body\.appendChild\(host\)/);
});

test('periodic host rebuild and empty-shell recovery hacks are removed', () => {
  assert.doesNotMatch(source, /function recoverUnhealthyEditorHost\(/);
  assert.doesNotMatch(source, /setInterval\(recoverUnhealthyEditorHost/);
  assert.doesNotMatch(source, /hostHealthFailures/);
  assert.doesNotMatch(source, /hostRecoveryPending/);
  assert.doesNotMatch(source, /function discardEmptyHost\(/);
  assert.doesNotMatch(source, /function scheduleActiveMountRetry\(/);
});
