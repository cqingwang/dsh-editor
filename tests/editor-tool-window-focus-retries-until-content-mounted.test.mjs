import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const helperSource = await readFile(new URL('../src/client/components/ui/focus-surface.ts', import.meta.url), 'utf8');
const uiSource = await readFile(new URL('../src/client/components/ui/index.tsx', import.meta.url), 'utf8');
const buildSource = await readFile(new URL('../scripts/build-client.mjs', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const focusSurfaceWhenReady = loadTypeScriptFunction(helperSource, 'focusSurfaceWhenReady');

test('a surface is focused only after its ref becomes available', () => {
  const frames = [];
  let attempts = 0;
  let target = null;
  let focusOptions = null;
  const requestFrame = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  const cancel = focusSurfaceWhenReady(
    () => {
      attempts += 1;
      return target;
    },
    {
      requestFrame,
      cancelFrame: () => {},
      maxAttempts: 3,
    },
  );

  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(attempts, 1);
  assert.equal(frames.length, 1);

  target = {
    isConnected: true,
    focus: (options) => {
      focusOptions = options;
    },
  };
  frames.shift()();

  assert.equal(attempts, 2);
  assert.deepEqual(focusOptions, { preventScroll: true });
  assert.equal(frames.length, 0);
  cancel();
});

test('cancelling a pending focus request prevents a stale activity steal', () => {
  const frames = [];
  let attempts = 0;
  const cancel = focusSurfaceWhenReady(
    () => {
      attempts += 1;
      return null;
    },
    {
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: () => {},
    },
  );

  cancel();
  frames.shift()();
  assert.equal(attempts, 0);
});

test('tool-window shortcuts retry their mounted content instead of focusing BODY', () => {
  assert.match(workspaceSource, /import \{ focusSurfaceWhenReady \} from '\.\/components\/ui\/focus-surface';/u);
  assert.match(
    uiSource,
    /export \{ focusSurfaceWhenReady, type FocusableSurface, type FocusSurfaceWhenReadyOptions \}/u,
  );
  assert.match(buildSource, /const uiExports = \[[\s\S]*?'focusSurfaceWhenReady'/u);
  const start = workspaceSource.indexOf('const focusToolWindowContent = React.useCallback(');
  const end = workspaceSource.indexOf('const rememberActivityToolWindowOrigin', start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const block = workspaceSource.slice(start, end);

  assert.match(block, /cancelFocusRequestRef\.current\?\.\(\);/u);
  assert.match(
    block,
    /focusSurfaceWhenReady\(\s*\(\) => \{[\s\S]*?activityRef\.current !== next[\s\S]*?panelVisibleRef\.current !== true/u,
  );
  assert.match(block, /onExhausted:[\s\S]*?focusWorkspaceFallback/u);
  assert.doesNotMatch(block, /setTimeout/u);

  const hideStart = workspaceSource.indexOf("if (action === 'hide')");
  const hideEnd = workspaceSource.indexOf('setPanelVisible(true);', hideStart);
  assert.ok(hideStart > 0 && hideEnd > hideStart);
  const hideBlock = workspaceSource.slice(hideStart, hideEnd);
  assert.match(hideBlock, /setPanelVisible\(false\);[\s\S]*?focusWorkspaceSurface\(\);/u);
  assert.doesNotMatch(hideBlock, /setTimeout/u);

  const editorStart = workspaceSource.indexOf('const focusWorkspaceSurface = React.useCallback(');
  const editorEnd = workspaceSource.indexOf("/* IDEA's combined diff can walk", editorStart);
  assert.ok(editorStart > 0 && editorEnd > editorStart);
  const editorBlock = workspaceSource.slice(editorStart, editorEnd);
  assert.match(editorBlock, /cancelFocusRequestRef\.current\?\.\(\);/u);
  assert.match(editorBlock, /focusSurfaceWhenReady\(\(\) => \{/u);
  assert.match(editorBlock, /if \(!diffOpen\) return editorRef\.current;/u);
});
