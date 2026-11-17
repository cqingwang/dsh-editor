import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceRootForRequest } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

test('an editor workspace id resolves without a live conversation session', () => {
  const resolved = workspaceRootForRequest({
    sessions: { get: () => { throw new Error('session lookup must not run'); } },
    workingDirectory: { get: () => '/wrong/session/root' },
    workspaceRegistry: {
      list: () => [{ id: 'workspace-a', path: '/private/tmp/project-a' }],
    },
    sessionId: '',
    workspaceId: 'workspace-a',
  });
  assert.equal(resolved, '/private/tmp/project-a');
});

test('the host refuses workspace ids that the registry does not own', () => {
  assert.throws(
    () => workspaceRootForRequest({
      sessions: { get: () => undefined },
      workingDirectory: null,
      workspaceRegistry: { list: () => [{ id: 'workspace-a', path: '/private/tmp/project-a' }] },
      sessionId: '',
      workspaceId: 'workspace-b',
    }),
    /not registered/,
  );
});

test('Project, Commit and the watcher carry the entry workspace id', () => {
  assert.match(client, /function currentEditorWorkspaceId\(\)/);
  assert.match(client, /JSON\.stringify\(\{ sessionId, workspaceId, \.\.\.payload \}\)/);
  assert.match(client, /api\/dsh-editor\/watch\?sessionId=.*?workspaceId=/s);
  assert.match(client, /function EditorWorkspace\(\{ t, workspaceId = '', initialHarnessCollapsed = false, onToggleHarness, onCloseEditor, onInsertHarnessReference \}\)/);
  assert.match(client, /'data-dsh-workspace-id': workspaceId \|\| undefined/);
  assert.match(host, /function workspaceRootForRequest\(/);
  assert.match(host, /const workspaceId = typeof body\?\.workspaceId === 'string'/);
});

test('the workspace context-menu entry opens the workspace it belongs to', () => {
  assert.match(client, /data-row-key\^="workspace:"/);
  assert.match(client, /openEditorSplit\(workspaceId\)/);
  assert.match(client, /React\.createElement\(EditorWorkspace, \{\s*t,\s*workspaceId: editorWorkspaceId,\s*initialHarnessCollapsed: harnessCollapsed,\s*onToggleHarness: toggleHarnessLayout,\s*onCloseEditor: \(\) => setActive\(false\),\s*onInsertHarnessReference: \(request\) => insertHarnessReferencesIntoComposer\(ctx, request\),\s*\}\)/s);
});
