import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractFunctionSource, loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const foundationSource = await readFile(new URL('src/client/foundation.ts', root), 'utf8');
const controllerSource = await readFile(new URL('src/client/controller.ts', root), 'utf8');
const { workspaceIdForConversationSession } = loadTypeScriptModule(
  extractFunctionSource(foundationSource, 'workspaceIdForConversationSession'),
  ['workspaceIdForConversationSession'],
);

test('conversation sessions resolve the Workspace that owns them', () => {
  const items = [
    { workspaceId: 'workspace-child-a', sessionIds: ['session-1', 'session-2'] },
    { workspaceId: 'workspace-dsh-editor', sessionIds: ['session-3'] },
  ];
  assert.equal(workspaceIdForConversationSession(items, 'session-1'), 'workspace-child-a');
  assert.equal(workspaceIdForConversationSession(items, 'session-3'), 'workspace-dsh-editor');
  assert.equal(workspaceIdForConversationSession(items, 'missing'), '');
  assert.equal(workspaceIdForConversationSession(null, 'session-1'), '');
  assert.equal(workspaceIdForConversationSession(items, ''), '');
});

test('the controller invalidates the Editor root when the host Workspace changes', () => {
  assert.match(controllerSource, /workspaceIdForConversationSession\(/u);
  assert.match(controllerSource, /data-conversation-session/u);
  assert.match(
    controllerSource,
    /conversationWorkspaceId !== editorConversationWorkspaceId[\s\S]*?editorWorkspaceId = conversationWorkspaceId;[\s\S]*?destroyHost\(\);/u,
  );
});

test('session changes inside one Workspace reuse the mounted Editor root', () => {
  const syncInner = controllerSource.slice(
    controllerSource.indexOf('function syncInner()'),
    controllerSource.indexOf('/**\n   * Insert an "Editor" item'),
  );
  assert.match(
    syncInner,
    /else if \(conversationWorkspaceId !== editorConversationWorkspaceId\) \{[\s\S]*?if \(conversationWorkspaceId !== editorWorkspaceId\) \{[\s\S]*?destroyHost\(\);/u,
  );
  assert.equal((syncInner.match(/destroyHost\(\)/gu) ?? []).length, 1);
});
