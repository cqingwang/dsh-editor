import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { terminalScopeForRequest } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function changeMenu() {
  const start = source.indexOf('const buildChangeMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const end = source.indexOf('const buildChangeDirMenu = React.useCallback(', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('the Commit file menu carries IDEA history, project reveal and terminal actions', () => {
  const menu = changeMenu();
  const history = menu.indexOf("id: 'history'");
  const reveal = menu.indexOf("id: 'reveal'");
  const terminal = menu.indexOf("id: 'openTerminal'");
  const copy = menu.indexOf("id: 'copyReference'");
  assert.ok(copy >= 0 && copy < history && history >= 0 && reveal > history && terminal > reveal);
  assert.match(menu, /label: t\('editor\.showHistory'\),[\s\S]*?showFileHistory\(change\.path\)/);
  assert.match(menu, /label: t\('editor\.revealInProject'\),[\s\S]*?revealPath\(change\.path\)/);
  assert.match(menu, /label: t\('editor\.openInTerminal'\),[\s\S]*?openInTerminal\(dirname\(change\.path\)\)/);
});

test('single-file Commit actions are disabled for a multi-row selection and wired as dependencies', () => {
  const menu = changeMenu();
  assert.match(menu, /disabled: paths\.length > 1/);
  assert.match(menu, /\[compareWithClipboard, compareWithHead, compareWithRevision, copySelectedPatch, createSelectedPatch, currentCodeEditor, currentCodePath, openFile, openInTerminal, addToGitignore, resolveConflict, restage, revealPath, rollback, root, showCombinedDiff, showFileHistory, t\]/);
});

test('terminal scope follows an explicit Editor workspace before the live session', () => {
  assert.equal(terminalScopeForRequest({ sessionId: 'session-a', workspaceId: 'workspace-b' }), 'workspace:workspace-b');
  assert.equal(terminalScopeForRequest({ sessionId: 'session-a', workspaceId: '' }), 'session-a');
  assert.throws(() => terminalScopeForRequest({ sessionId: '', workspaceId: '' }), /sessionId or workspaceId/);
});

test('terminal create, stream and local preferences carry the Editor workspace scope', () => {
  const callStart = source.indexOf('async function callTerminal(payload)');
  const callEnd = source.indexOf('/**', callStart);
  const call = source.slice(callStart, callEnd);
  assert.match(source, /function currentTerminalScope\(\)/);
  assert.match(call, /const workspaceId = currentEditorWorkspaceId\(\)/);
  assert.match(call, /JSON\.stringify\(\{ sessionId, workspaceId, \.\.\.payload \}\)/);
  assert.match(call, /no active Session or workspace/);
  assert.match(source, /api\/dsh-editor\/terminal\/stream\?sessionId=\$\{encodeURIComponent\(sessionId\)\}&workspaceId=\$\{encodeURIComponent\(workspaceId\)\}&id=/);
  assert.match(source, /dsh-editor\.terminal\.profile:\$\{currentTerminalScope\(\)\}/);
  assert.match(source, /dsh-editor\.terminal\.closed:\$\{currentTerminalScope\(\)\}/);
  assert.match(source, /dsh-editor\.terminal\.editor:\$\{currentTerminalScope\(\)\}/);
  assert.match(source, /dsh-editor\.terminal\.colors:\$\{currentTerminalScope\(\)\}/);

  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  const terminalRoute = host.slice(host.indexOf("path: '/api/dsh-editor/terminal',"), host.indexOf("path: '/api/dsh-editor/terminal/stream',"));
  assert.match(terminalRoute, /workspaceRootForRequest\(/);
  assert.match(terminalRoute, /terminalScopeForRequest/);
  assert.match(terminalRoute, /terminals\.list\(terminalScopeId\)/);
  assert.match(terminalRoute, /sessionId: terminalScopeId/);
});
