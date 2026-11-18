import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Search Everywhere file and text rows expose an IDEA-style context menu', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  const menu = source.slice(source.indexOf('function searchResultContextItems('), source.indexOf('function searchEverywhereOptionId('));
  assert.match(dialog, /const \[resultMenu, setResultMenu\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(dialog, /onContextMenu: \(event\) => openResultMenu\(event, result\)/);
  assert.match(menu, /t\('editor\.openInRightSplit'\)/);
  assert.match(menu, /t\('editor\.openInEditor'\)/);
  assert.match(menu, /t\('editor\.copyRelativePath'\)/);
  assert.match(menu, /t\('editor\.copyPathWithLineIdea'\)/);
  assert.match(menu, /t\('editor\.revealInProject'\)/);
});

test('context menu actions close Search Everywhere before navigating', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /onOpenInRightSplit\([\s\S]{0,100}(?:path|result\.path)[\s\S]{0,180}result\.kind === 'text'/);
  assert.match(dialog, /onRevealResult\((?:path|result\.path)\)/);
  assert.match(dialog, /onClose\(\);\s*onOpenInRightSplit\([\s\S]{0,120}(?:path|result\.path)/);
  assert.match(dialog, /onClose\(\);\s*onRevealResult\((?:path|result\.path)\)/);
});

test('text search copy action carries line and column while file copy stays path-only', () => {
  const menu = source.slice(source.indexOf('function searchResultContextItems('), source.indexOf('function searchEverywhereOptionId('));
  const copy = source.slice(source.indexOf('function copySearchResultText('), source.indexOf('function searchResultContextItems('));
  assert.match(menu, /result\.kind === 'text' \? `\$\{result\.path\}:\$\{result\.line\}:\$\{result\.column\}` : result\.path/);
  assert.match(copy, /navigator\.clipboard\?\.writeText/);
});

test('Search Everywhere receives right-split and reveal callbacks from the Editor', () => {
  const opened = [];
  const revealed = [];
  const openInRightSplit = loadTypeScriptCallback(workspaceSource, 'openInRightSplit', {
    openFile: async (path) => {
      opened.push(path);
      return true;
    },
    revealSplitLocation: () => {},
    splitTabsRef: { current: [] },
    setSplitTabs: () => {},
    setSplitPath: () => {},
    splitPathRef: { current: null },
    activePathRef: { current: null },
    setAnnotateTarget: () => {},
    setActivePath: () => {},
    splitEditorRef: { current: { focus: () => {} } },
    window: { setTimeout: (callback) => callback() },
  });
  const revealPath = loadTypeScriptCallback(workspaceSource, 'revealPath', {
    applyProjectView: () => {},
    lastProjectTreeViewRef: { current: 'projectFiles' },
    setActivity: () => {},
    setPanelVisible: () => {},
    revealInProjectTree: async (path) => revealed.push(path),
  });
  return openInRightSplit('src/a.ts', { path: 'src/a.ts', line: 1, column: 1 }).then(() => {
    assert.deepEqual(opened, ['src/a.ts']);
    return revealPath('src/a.ts');
  }).then(() => {
    assert.deepEqual(revealed, ['src/a.ts']);
  });
});
