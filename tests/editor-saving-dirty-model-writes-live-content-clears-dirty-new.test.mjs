import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const searchEverywhereSource = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const source = [
  searchEverywhereSource,
  workspaceSource,
  await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'),
  commitSource,
  terminalSource,
].join('\n');

function extractFunction(name) {
  return transpileTypeScriptFunction(name === 'searchEverywherePreviewWindow' ? commitSource : terminalSource, name);
}

function lines(count) {
  return Array.from({ length: count }, (_, index) => `line-${index + 1}`).join('\n');
}

test('saving a dirty model writes live content and clears dirty with the new mtime', () => {
  const savePath = source.slice(source.indexOf('const savePath ='), source.indexOf('/* Save the active model. */'));
  assert.match(savePath, /content: model\.getValue\(\)/u);
  assert.match(savePath, /mtime: file\?\.mtime \?\? undefined,\s+force,/u);
  assert.match(
    savePath,
    /entry\.path === path\s+\? \{[\s\S]*?content: model\.getValue\(\),[\s\S]*?dirty: false,[\s\S]*?mtime: typeof value\.mtime === 'number' \? value\.mtime : entry\.mtime,/u,
  );
});

test('Search Everywhere text requests invalidate stale responses after open-file changes', () => {
  const effect = source.slice(source.indexOf('const searchEverywhereRawQuery'), source.indexOf('const openFindTool ='));
  assert.match(effect, /const requestId = \+\+searchTextRequestRef\.current/u);
  assert.match(effect, /if \(searchTextRequestRef\.current !== requestId\) return;/gu);
  assert.match(effect, /searchEverywhere\?\.fileMask,\s+openFiles,\s+t,/u);
});

test('Dirty buffers replace host rows instead of duplicating the same path', () => {
  const merge = extractFunction('mergeFindToolDirtyMatches');
  assert.match(merge, /const dirtyPaths = new Set(?:<string>)?\(\)/u);
  assert.match(merge, /dirtyPaths\.add\(file\.path\)/u);
  assert.match(merge, /\.filter\(\s*\(?match\)? => !dirtyPaths\.has\(match\?\.path \?\? ''\),?\s*\)/u);
  assert.match(merge, /const matches = \[\.\.\.selectedDirty, \.\.\.selectedHost\]/u);
});

test('Dirty text preview reads the live buffer and the exact match line', () => {
  const dialog = searchEverywhereSource.slice(searchEverywhereSource.indexOf('function SearchEverywhere('));
  assert.match(dialog, /activeResult\.kind === 'text' && activeResult\.dirty === true/u);
  assert.match(
    dialog,
    /content: typeof liveFile\?\.content === 'string' \? liveFile\.content : '',\s+line: activeResult\.line \?\? 1/u,
  );
  assert.match(dialog, /previewState\.content,\s+previewState\.line/u);
});

test('402-line files retain the final match inside the bounded preview window', () => {
  const window = new Function(
    `${extractFunction('searchEverywherePreviewWindow')}; return searchEverywherePreviewWindow;`,
  )();
  const content = lines(402);
  assert.deepEqual(window(content, 402, 401), {
    start: 2,
    end: 402,
    truncatedBefore: true,
    truncatedAfter: false,
  });
  assert.deepEqual(window(content, 200, 401), {
    start: 1,
    end: 401,
    truncatedBefore: false,
    truncatedAfter: true,
  });
});

test('all text-result open paths retain line-centered navigation', () => {
  assert.match(source, /const openFileAtLocation = React\.useCallback\(\s*\([\s\S]*?path[\s\S]*?\) =>/u);
  assert.match(source, /pendingReveal\.current = \{ path, line, column \}/u);
  assert.match(source, /revealLines\(path, line, column\)/u);
  assert.match(source, /editor\.revealLineInCenter\(safeLine\)/u);
  assert.match(source, /openFileAtLocation\(result\.path, result\.line, result\.column\)/u);
  assert.match(source, /openFileAtLocation\(match\.path, match\.line, match\.column\)/u);
});
