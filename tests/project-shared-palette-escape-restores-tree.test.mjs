import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);
const revisionSource = await readFile(
  new URL('../src/client/components/commit/RevisionPicker.tsx', import.meta.url),
  'utf8',
);
const moveSource = await readFile(
  new URL('../src/client/components/commit/MoveToPicker.tsx', import.meta.url),
  'utf8',
);

test('Move To and Compare with Revision capture a shared palette origin', () => {
  assert.match(
    workspaceSource,
    /const compareWithRevision = React\.useCallback\([\s\S]*?rememberPaletteOrigin\(\);/u,
  );
  assert.match(
    workspaceSource,
    /const openMoveTo = React\.useCallback\([\s\S]*?rememberPaletteOrigin\(\);/u,
  );
  assert.match(workspaceSource, /onClose=\{closeMoveTo\}/u);
  assert.match(workspaceSource, /onClose=\{closeRevisionPicker\}/u);
  assert.match(revisionSource, /data-dsh-revision-picker=''/u);
  assert.match(moveSource, /data-dsh-move-to-picker=''/u);
});

test('palette cancellation restores a connected Project tree instead of BODY', () => {
  let focused = false;
  const previous = {
    isConnected: true,
    focus() {
      focused = true;
    },
  };
  const paletteReturnFocusRef = { current: previous };
  let editorRequested = false;
  const restorePaletteFocus = loadTypeScriptCallback(workspaceSource, 'restorePaletteFocus', {
    paletteReturnFocusRef,
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
  restorePaletteFocus();
  assert.equal(focused, true);
  assert.equal(editorRequested, false);
  assert.equal(paletteReturnFocusRef.current, null);
});

test('successful palette choices clear the old origin before navigation', () => {
  assert.match(
    workspaceSource,
    /onPick=\{\(directory\) => \{[\s\S]*?paletteReturnFocusRef\.current = null;[\s\S]*?setMoveTo\(null\);[\s\S]*?void moveEntry/u,
  );
  assert.match(
    workspaceSource,
    /onPick=\{\(hash\) => \{[\s\S]*?paletteReturnFocusRef\.current = null;[\s\S]*?setRevisionPicker\(null\);/u,
  );
});

test('menu-driven pickers reclaim the input after ContextMenu restores its opener', () => {
  for (const source of [revisionSource, moveSource]) {
    assert.match(source, /const inputRef = React\.useRef<HTMLInputElement \| null>\(null\);/u);
    assert.match(source, /window\.setTimeout\(\(\) => inputRef\.current\?\.focus\(\), 40\)/u);
    assert.match(source, /ref=\{inputRef\}/u);
    assert.match(source, /window\.clearTimeout\(timer\)/u);
  }
});
