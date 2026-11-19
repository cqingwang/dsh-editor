import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('the desktop App keeps the native Add workspace action', async () => {
  const model = await read('src/client/components/project/workspace-directory-model.ts');
  const controller = await read('src/client/controller.ts');

  assert.match(model, /export function isDesktopHarnessSurface\(/u);
  assert.match(controller, /isDesktopHarnessSurface\(document\.documentElement\)/u);
  assert.match(controller, /if \(isDesktopHarnessSurface\(document\.documentElement\)\) return;/u);
});

test('Web Add workspace is intercepted and routed through public host services', async () => {
  const controller = await read('src/client/controller.ts');

  assert.match(controller, /aria-keyshortcuts="Alt\+Meta\+O"/u);
  assert.match(controller, /event\.stopImmediatePropagation\(\)/u);
  assert.match(controller, /callWorkspaceDirectoryPicker\(/u);
  assert.match(controller, /listDirectory\?: \(path\?: string, signal\?: AbortSignal\) => Promise<unknown>/u);
  assert.match(controller, /const listDirectory = uiWorkspace\?\.listDirectory\?\.bind\(uiWorkspace\);/u);
  assert.match(controller, /let workspaceDirectoryProvider: 'unknown' \| 'public' \| 'bridge' = 'unknown';/u);
  assert.match(controller, /workspaceDirectoryProvider !== 'bridge' && listDirectory !== undefined/u);
  assert.match(controller, /workspaceDirectoryProvider = 'public';/u);
  assert.match(controller, /workspaceDirectoryProvider = 'bridge';/u);
  assert.match(controller, /isDirectoryBrowseUnavailable\(reason\)/u);
  assert.match(
    controller,
    /catch \(reason\)[\s\S]*?if \(!isDirectoryBrowseUnavailable\(reason\)\) throw reason;[\s\S]*?callWorkspaceDirectoryPicker\(/u,
  );
  assert.match(controller, /listDirectory: listDirectoryForPicker,/u);
  assert.match(controller, /create\(\{ path \}\)/u);
  assert.match(controller, /startSession\(/u);
  assert.match(controller, /const followCreatedWorkspace = active;/u);
  assert.match(controller, /if \(followCreatedWorkspace\) openEditorSplit\(workspaceId\);/u);
  assert.match(controller, /React\.createElement\(WorkspaceDirectoryPicker,[\s\S]*?createWorkspace:/u);
});
