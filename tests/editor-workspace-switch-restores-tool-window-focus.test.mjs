import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const controller = await readFile(new URL('src/client/controller.ts', root), 'utf8');
const mount = await readFile(new URL('src/client/components/editor/EditorMount.tsx', root), 'utf8');
const workspace = await readFile(new URL('src/client/editor-workspace.tsx', root), 'utf8');

test('Workspace-scoped Editor remounts restore focus inside the active tool window', () => {
  assert.match(controller, /let restoreActiveToolWindowOnMount = false;/u);
  assert.match(controller, /let restoreToolWindowActivity: 'project' \| 'commit' = 'project';/u);
  assert.match(controller, /if \(active\) \{\s+restoreActiveToolWindowOnMount = true;\s+restoreToolWindowActivity =/u);
  assert.match(controller, /restoreToolWindowFocus: restoreActiveToolWindowOnMount,/u);
  assert.match(controller, /restoreActiveToolWindowOnMount = false;/u);
  assert.match(controller, /focusSurfaceWhenReady\(/u);
  assert.match(controller, /reassertFrames: 60/u);
  assert.match(controller, /activeElement\.closest\('\[data-dsh-editor-tool-window\]'\)/u);
  assert.match(controller, /data-dsh-activity-id="commit"\]\[aria-pressed="true"\]/u);
  assert.match(controller, /data-dsh-activity-id="\$\{restoreToolWindowActivity\}"/u);
  assert.match(mount, /restoreToolWindowFocus\?: boolean;/u);
  assert.match(mount, /restoreToolWindowFocus=\{restoreToolWindowFocus\}/u);
  assert.match(workspace, /restoreToolWindowFocus\?: boolean;/u);
  assert.match(workspace, /restoreToolWindowFocus=\{restoreToolWindowFocus\}/u);
  assert.match(workspace, /const suppressEditorAutofocusRef = React\.useRef\(restoreToolWindowFocus === true\);/u);
  assert.match(workspace, /suppressEditorAutofocusRef\.current !== true[\s\S]*?editor\.focus\(\)/u);
  assert.match(
    workspace,
    /const restoreRequested = restoreToolWindowFocus === true && restoredToolWindowFocusRef\.current !== -1;[\s\S]*?const focusRequested = focusRequest !== restoredToolWindowFocusRef\.current;[\s\S]*?focusToolWindowContent\(activity, \{ reassertFrames: 8, focusActivityFallback: true \}\)/u,
  );
  assert.match(workspace, /data-dsh-activity-id="\$\{next\}"/u);
  assert.match(workspace, /releaseFrames >= 90[\s\S]*?suppressEditorAutofocusRef\.current = false;/u);
});

test('reopening the mounted Editor restores focus inside the active tool window', () => {
  assert.match(controller, /let editorWorkspaceFocusRequest = 0;/u);
  assert.match(
    controller,
    /const reopeningMountedHost = host !== null && active === false;[\s\S]*?const restorationTarget = reopeningMountedHost \? lastEditorWorkspaceFocusTarget : null;[\s\S]*?if \(reopeningMountedHost && \(restorationTarget === null \|\| restorationTarget\.isConnected !== true\)\) \{[\s\S]*?editorWorkspaceFocusRequest \+= 1;[\s\S]*?\}/u,
  );
  assert.match(controller, /focusRequest: editorWorkspaceFocusRequest,/u);
  assert.match(controller, /function renderEditorMount\(\): void \{[\s\S]*?root\?\.render\(/u);
  assert.match(controller, /setActive\(true\);[\s\S]*?if \(reopeningMountedHost\) renderEditorMount\(\);/u);
  assert.match(mount, /focusRequest\?: number;/u);
  assert.match(mount, /focusRequest=\{focusRequest\}/u);
  assert.match(workspace, /focusRequest\?: number;/u);
  assert.match(
    workspace,
    /const restoredToolWindowFocusRef = React\.useRef\(focusRequest\);/u,
  );
  assert.match(
    workspace,
    /const focusRequested = focusRequest !== restoredToolWindowFocusRef\.current;[\s\S]*?restoredToolWindowFocusRef\.current = restoreRequested === true \? -1 : focusRequest;[\s\S]*?focusToolWindowContent\(activity, \{ reassertFrames: 8, focusActivityFallback: true \}\);/u,
  );
});

test('reopening the mounted Editor restores the last focused workspace surface', () => {
  assert.match(controller, /let lastEditorWorkspaceFocusTarget: HTMLElement \| null = null;/u);
  assert.match(
    controller,
    /host\.addEventListener\('focusin', \(event\) => \{[\s\S]*?target\.closest\('\[data-dsh-editor-activity-stripe\]'\)[\s\S]*?lastEditorWorkspaceFocusTarget = target;/u,
  );
  assert.match(
    controller,
    /const restorationTarget = reopeningMountedHost \? lastEditorWorkspaceFocusTarget : null;[\s\S]*?if \(reopeningMountedHost && \(restorationTarget === null \|\| restorationTarget\.isConnected !== true\)\) \{[\s\S]*?editorWorkspaceFocusRequest \+= 1;/u,
  );
  assert.match(
    controller,
    /if \(restorationTarget !== null && restorationTarget\.isConnected === true\) \{[\s\S]*?focusSurfaceWhenReady\(\(\) => \(restorationTarget\.isConnected === true \? restorationTarget : null\),[\s\S]*?\} else if \(reopeningMountedHost\) renderEditorMount\(\);/u,
  );
});
