import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const popup = await readFile(new URL('src/client/components/search/FindToolPopup.tsx', root), 'utf8');
const picker = await readFile(new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root), 'utf8');
const controller = await readFile(new URL('src/client/controller.ts', root), 'utf8');

test('the shared floating popup owns opt-in dialog focus trapping and escape', () => {
  assert.match(popup, /trapFocus\?: boolean/u);
  assert.match(popup, /onRequestClose\?: \(\) => void/u);
  assert.match(popup, /returnFocusElement\?: HTMLElement \| null/u);
  assert.match(popup, /import \{ trapDialogFocus \} from '\.\.\/ui\/focus-trap';/u);
  assert.match(popup, /trapDialogFocus\(event, surfaceRef\.current, \{ focusWhenOutside: true \}\);/u);
  assert.doesNotMatch(popup, /querySelectorAll</u);
  assert.match(popup, /event\.key === 'Escape'/u);
  assert.match(popup, /role=\{trapFocus === true \? 'dialog' : undefined\}/u);
  assert.match(popup, /aria-modal=\{trapFocus === true \? 'true' : undefined\}/u);
  assert.match(popup, /target\?\.isConnected/u);
});

test('the directory picker opts into the shared modal behavior', () => {
  assert.match(picker, /returnFocusElement\?: HTMLElement \| null/u);
  assert.match(picker, /trapFocus=\{true\}/u);
  assert.match(picker, /onRequestClose=/u);
  assert.match(picker, /returnFocusElement=\{returnFocusElement\}/u);
  assert.match(picker, /ariaLabel=\{t\(['"]editor\.workspaceDirectoryTitle['"]\)\}/u);
});

test('the controller passes the Add workspace button back as the opener', () => {
  assert.match(controller, /openWorkspaceDirectoryPicker\(button\)/u);
  assert.match(controller, /returnFocusElement:\s*opener/u);
});
