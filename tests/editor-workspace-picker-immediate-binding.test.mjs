import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractFunctionSource, loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const foundationSource = await readFile(new URL('src/client/foundation.ts', root), 'utf8');
const controllerSource = await readFile(new URL('src/client/controller.ts', root), 'utf8');
const { workspaceIdForUniqueTitle } = loadTypeScriptModule(
  extractFunctionSource(foundationSource, 'workspaceIdForUniqueTitle'),
  ['workspaceIdForUniqueTitle'],
);

test('the host workspace picker resolves only a unique visible title', () => {
  const items = [
    { workspaceId: 'workspace-dsh-editor', title: 'dsh-editor' },
    { workspaceId: 'workspace-child-a', title: 'child-a' },
    { workspaceId: 'workspace-duplicate-1', title: 'duplicate' },
    { workspaceId: 'workspace-duplicate-2', title: 'duplicate' },
  ];
  assert.equal(workspaceIdForUniqueTitle(items, 'dsh-editor'), 'workspace-dsh-editor');
  assert.equal(workspaceIdForUniqueTitle(items, ' child-a '), 'workspace-child-a');
  assert.equal(workspaceIdForUniqueTitle(items, 'duplicate'), '');
  assert.equal(workspaceIdForUniqueTitle(items, 'missing'), '');
  assert.equal(workspaceIdForUniqueTitle(null, 'dsh-editor'), '');
});

test('the controller switches Editor in the picker click and leaves duplicate titles to session binding', () => {
  assert.match(controllerSource, /workspaceIdForUniqueTitle\(/u);
  assert.match(controllerSource, /function onWorkspacePickerClick\(event: MouseEvent\): void/u);
  assert.match(controllerSource, /function isWorkspacePickerMenu\(menu: Element\): boolean/u);
  assert.match(controllerSource, /dsw-icon-folder-close-regular/u);
  assert.match(controllerSource, /dsw-icon-plus-outline-regular/u);
  assert.match(controllerSource, /item\.closest\('\[data-dsh-editor-host\]'\) !== null/u);
  assert.match(controllerSource, /const menu = item\.closest\('\[role="menu"\]'\);/u);
  assert.match(controllerSource, /menu === null \|\| !isWorkspacePickerMenu\(menu\)/u);
  assert.match(
    controllerSource,
    /if \(workspaceId === '' \|\| workspaceId === editorWorkspaceId\) return;[\s\S]*?editorConversationWorkspaceId = workspaceId;[\s\S]*?openEditorSplit\(workspaceId\);/u,
  );
  assert.match(controllerSource, /document\.addEventListener\('click', onWorkspacePickerClick, true\);/u);
  assert.match(controllerSource, /document\.removeEventListener\('click', onWorkspacePickerClick, true\);/u);
});
