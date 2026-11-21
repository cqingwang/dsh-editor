import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const dialog = await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const focusSurface = await readFile(new URL('../src/client/components/ui/focus-surface.ts', import.meta.url), 'utf8');
const resolveFocusSurface = loadTypeScriptFunction(focusSurface, 'resolveFocusSurface');

test('Search Everywhere separates dismissal from action-driven close', () => {
  assert.match(dialog, /onDismiss\?: \(\) => void;/u);
  assert.match(dialog, /const dismissSearchEverywhere = onDismiss \?\? onClose;/u);
  assert.match(workspace, /onBackdropMouseDown=\{dismissSearchEverywhere\}/u);
  assert.equal((dialog.match(/event\.key === 'Escape'[\s\S]{0,120}?dismissSearchEverywhere\(\)/gu) ?? []).length, 2);
});

test('dismiss resolves the opener before the tool window or editor fallback', () => {
  const previous = { isConnected: true, focus() {} };
  const toolWindow = { isConnected: true, focus() {} };
  const editor = { isConnected: true, focus() {} };
  assert.equal(resolveFocusSurface(previous, toolWindow, editor), previous);
  assert.equal(resolveFocusSurface({ isConnected: false, focus() {} }, toolWindow, editor), toolWindow);
  assert.equal(resolveFocusSurface(null, null, editor), editor);
  assert.equal(resolveFocusSurface(null, null, null), null);
});

test('dismiss restores focus after React unmounts the dialog', () => {
  assert.match(workspace, /searchEverywhereReturnFocusRef = React\.useRef<HTMLElement \| null>\(null\)/u);
  assert.match(
    workspace,
    /if \(\s*activeElement !== null &&\s*activeElement !== document\.body &&\s*!activeElement\.closest\('\[data-dsh-search-everywhere\]'\)\s*\)\s*searchEverywhereReturnFocusRef\.current = activeElement;/u,
  );
  assert.match(
    workspace,
    /const dismissSearchEverywhere = React\.useCallback\(\(\) => \{[\s\S]*?const previous = searchEverywhereReturnFocusRef\.current;[\s\S]*?setSearchEverywhere\(null\);[\s\S]*?cancelFocusRequestRef\.current = focusSurfaceWhenReady\([\s\S]*?maxAttempts: 8,\s+reassertFrames: 2,/u,
  );
  assert.match(
    workspace,
    /document\.querySelector<HTMLElement>\('\[data-dsh-changes-list\], \[data-dsh-project-tree\]'\)/u,
  );
  assert.match(workspace, /onDismiss=\{dismissSearchEverywhere\}/u);
});
