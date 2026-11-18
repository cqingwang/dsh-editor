import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  workspaceSource +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('right split opening accepts an optional text location', async () => {
  const opened = [];
  const revealed = [];
  const splitTabsRef = { current: [] };
  const splitPathRef = { current: null };
  const openInRightSplit = loadTypeScriptCallback(workspaceSource, 'openInRightSplit', {
    openFile: async (path) => {
      opened.push(path);
      return true;
    },
    revealSplitLocation: (path, line, column) => revealed.push({ path, line, column }),
    splitTabsRef,
    setSplitTabs: () => {},
    setSplitPath: () => {},
    splitPathRef,
    activePathRef: { current: 'left.ts' },
    setAnnotateTarget: () => {},
    setActivePath: () => {},
    splitEditorRef: { current: { focus: () => {} } },
    window: { setTimeout: (callback) => callback() },
  });
  await openInRightSplit('a.ts', { path: 'a.ts', line: 7, column: 3 });
  assert.deepEqual(opened, ['a.ts']);
  assert.deepEqual(revealed, [{ path: 'a.ts', line: 7, column: 3 }]);
  assert.equal(splitPathRef.current, 'a.ts');
});

test('split location reveal waits for the split model and clamps to it', () => {
  const start = source.indexOf('const revealSplitLocation = React.useCallback');
  const end = source.indexOf('const openInRightSplit =', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const reveal = source.slice(start, end);
  assert.match(reveal, /splitEditorRef\.current/);
  assert.match(reveal, /getLineCount\(\)/);
  assert.match(reveal, /getLineMaxColumn\(safeLine\)/);
  assert.match(reveal, /revealLineInCenter\(safeLine\)/);
  assert.match(reveal, /setSelection\(new window\.monaco\.Range/);
  assert.match(reveal, /editor\.focus\(\)/);
  assert.match(reveal, /requestAnimationFrame\(reveal\)/);
});

test('Search Everywhere and Find pass location only for text results', () => {
  assert.match(
    source,
    /onOpenInRightSplit: \(\) => \{[\s\S]{0,100}onClose\(\);[\s\S]{0,260}onOpenInRightSplit\([\s\S]{0,100}(?:path|result\.path),[\s\S]{0,180}result\.kind === 'text'/,
  );
  assert.match(
    source,
    /onOpenInRightSplit: \(\) =>\s+onOpenInRightSplit\(\s+(?:path|result\.path),[\s\S]{0,180}result\.kind === 'text'/u,
  );
});

test('Editor forwards the split location without changing file-result behavior', async () => {
  const opened = [];
  const revealed = [];
  const splitPathRef = { current: null };
  const openInRightSplit = loadTypeScriptCallback(workspaceSource, 'openInRightSplit', {
    openFile: async (path) => {
      opened.push(path);
      return true;
    },
    revealSplitLocation: (path, line, column) => revealed.push({ path, line, column }),
    splitTabsRef: { current: [] },
    setSplitTabs: () => {},
    setSplitPath: () => {},
    splitPathRef,
    activePathRef: { current: 'left.ts' },
    setAnnotateTarget: () => {},
    setActivePath: () => {},
    splitEditorRef: { current: { focus: () => {} } },
    window: { setTimeout: (callback) => callback() },
  });
  await openInRightSplit(['a.ts', 'b.ts'], null);
  assert.deepEqual(opened, ['a.ts', 'b.ts']);
  assert.deepEqual(revealed, []);
  assert.equal(splitPathRef.current, 'b.ts');
});

test('right-clicking a Search Everywhere result does not activate and close the dialog', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /onMouseDown=\{\(event\) => \{\s+if \(event\.button !== 0\) return;\s+event\.preventDefault\(\);/);
});
