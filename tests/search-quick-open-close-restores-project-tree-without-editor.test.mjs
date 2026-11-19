import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);
const quickOpenSource = await readFile(
  new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url),
  'utf8',
);

test('Go to File and Recent Files remember their opener', () => {
  assert.match(
    workspaceSource,
    /const rememberQuickOpenOrigin = React\.useCallback\(\(\) => \{[\s\S]*?quickOpenReturnFocusRef\.current = activeElement;/u,
  );
  assert.match(workspaceSource, /const openQuickOpen = [\s\S]*?rememberQuickOpenOrigin\(\);/u);
  assert.match(workspaceSource, /const openRecent = React\.useCallback\(\(\) => \{[\s\S]*?rememberQuickOpenOrigin\(\);/u);
  assert.match(quickOpenSource, /data-dsh-quick-open=''/u);
});

test('closing QuickOpen restores a connected Project tree instead of BODY', () => {
  let closed = false;
  let focused = false;
  const previous = {
    isConnected: true,
    focus() {
      focused = true;
    },
  };
  const quickOpenReturnFocusRef = { current: previous };
  let editorRequested = false;
  const closeQuickOpen = loadTypeScriptCallback(workspaceSource, 'closeQuickOpen', {
    quickOpenReturnFocusRef,
    quickOpenFilesRequestRef: { current: 0 },
    quickOpenFilesAbortRef: { current: null },
    setQuickOpen: (value) => {
      closed = value === null;
    },
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    currentCodePath: () => null,
    currentCodeEditor: () => {
      editorRequested = true;
      return null;
    },
    document: { querySelector: () => null },
    focusWorkspaceFallback: () => false,
  });
  closeQuickOpen();
  assert.equal(closed, true);
  assert.equal(focused, true);
  assert.equal(editorRequested, false);
  assert.equal(quickOpenReturnFocusRef.current, null);
});

test('opening a QuickOpen result clears the old origin before navigation', () => {
  assert.match(
    workspaceSource,
    /onOpen=\{\(path\) => \{[\s\S]*?quickOpenReturnFocusRef\.current = null;[\s\S]*?setQuickOpen\(null\);[\s\S]*?void openFile\(path\);/u,
  );
  assert.match(workspaceSource, /onClose=\{closeQuickOpen\}/u);
});

test('QuickOpen reclaims its input after a Project Options menu closes', () => {
  assert.match(quickOpenSource, /const inputRef = React\.useRef<HTMLInputElement \| null>\(null\);/u);
  assert.match(quickOpenSource, /window\.setTimeout\(\(\) => inputRef\.current\?\.focus\(\), 40\)/u);
  assert.match(quickOpenSource, /ref=\{inputRef\}/u);
  assert.match(quickOpenSource, /window\.clearTimeout\(timer\)/u);
});
