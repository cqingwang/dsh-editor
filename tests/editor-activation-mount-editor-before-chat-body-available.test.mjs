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

test('activation can mount the Editor before the Chat body is available', () => {
  const setActive = block('function setActive(next) {', '/**\n       * Reconcile the injected DOM');
  assert.match(setActive, /applyChatWidth\(readChatWidth\(\)\);/);
  assert.match(setActive, /ensureHost\(body\);/);
  assert.doesNotMatch(setActive, /scheduleActiveMountRetry/);
});

test('a replaced Chat body keeps the existing React root mounted', () => {
  const syncInner = block('function syncInner() {', '/**\n       * Insert an "Editor" item');
  assert.match(syncInner, /ensureHost\(body\);/);
  assert.doesNotMatch(syncInner, /discardEmptyHost/);
  const workspaceGuard = syncInner.indexOf('conversationWorkspaceId !== editorConversationWorkspaceId');
  const destroyAt = syncInner.indexOf('destroyHost()');
  const ensureAt = syncInner.indexOf('ensureHost(body);');
  assert.ok(workspaceGuard >= 0, 'workspace identity guard is missing');
  assert.ok(destroyAt > workspaceGuard, 'root teardown must be workspace-scoped');
  assert.ok(destroyAt < ensureAt, 'workspace teardown must run before remount');
  assert.equal((syncInner.match(/destroyHost\(\)/gu) ?? []).length, 1);
});

test('the final integration has no activation retry or health watchdog', () => {
  assert.doesNotMatch(source, /function scheduleActiveMountRetry\(/);
  assert.doesNotMatch(source, /function recoverUnhealthyEditorHost\(/);
  assert.doesNotMatch(source, /activeMountAttempts/);
  assert.doesNotMatch(source, /editorActivatedAt/);
});
