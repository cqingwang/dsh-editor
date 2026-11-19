import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const diffSource = await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8');

test('hiding Commit from the keyboard returns focus to the visible diff', () => {
  assert.match(
    workspaceSource,
    /if \(action === 'hide'\) \{[\s\S]*?setPanelVisible\(false\);[\s\S]*?focusEditorSurface\(\);/u,
  );
  assert.doesNotMatch(
    workspaceSource,
    /if \(action === 'hide'\) \{[\s\S]*?const editor = currentCodeEditor\(\);[\s\S]*?editor\.focus\?\.\(\);/u,
  );
});

test('focusEditorSurface routes visible diff focus through its scoped event', () => {
  const events = [];
  const host = {
    dispatchEvent(event) {
      events.push(event.type);
      return true;
    },
  };
  const focusEditorSurface = loadTypeScriptCallback(workspaceSource, 'focusEditorSurface', {
    cancelFocusRequestRef: { current: null },
    focusSurfaceWhenReady: (resolveSurface) => {
      const surface = resolveSurface();
      surface?.focus();
      return () => {};
    },
    diffOpen: true,
    editorRef: {
      current: {
        getDomNode: () => ({
          closest() {
            return host;
          },
        }),
      },
    },
    CustomEvent: class {
      constructor(type) {
        this.type = type;
      }
    },
  });
  focusEditorSurface();
  assert.deepEqual(events, ['dsh-editor-focus-diff']);
  assert.match(diffSource, /host\.addEventListener\('dsh-editor-focus-diff', onFocus\)/u);
  assert.match(diffSource, /const onFocus = \(\) => focusDiffRef\.current\?\.\(\);/u);
});
