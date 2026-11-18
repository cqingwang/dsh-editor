import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const terminalPanelSource = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const source = `${workspaceSource}\n${terminalSource}\n${terminalPanelSource}\n${projectPanelSource}`;
const collectFilePaths = loadTypeScriptFunction(terminalSource, 'collectFilePaths');

test('collectFilePaths keeps files only and ignores junk entries', () => {
  const paths = collectFilePaths([
    { path: 'a.txt', kind: 'file' },
    { path: 'src', kind: 'directory' },
    { path: 'b.txt', kind: 'file' },
    { kind: 'file' },
    null,
    undefined,
    { path: 42, kind: 'file' },
  ]);
  assert.deepEqual(paths, ['a.txt', 'b.txt']);
  assert.deepEqual(collectFilePaths(null), []);
  assert.deepEqual(collectFilePaths('nope'), []);
});

test('the first refresh establishes a baseline instead of marking everything new', () => {
  /* Without this guard, every file would flash green on the first load. */
  assert.match(source, /if \(known === null\) \{/);
  /* The baseline must come from the freshly fetched listing, not the render snapshot. */
  assert.match(source, /knownPathsRef\.current = new Set\(\s+collectFilePaths\(listing \?\? \[\]\),\s+\);/);
  assert.match(source, /const listing = await loadRoot\(\);/);
  assert.match(source, /First refresh only establishes the baseline: nothing is "new" yet\./);
});

test('a path stops being new once it disappears from the listing', () => {
  assert.match(source, /for \(const path of visible\) if \(!known\.has\(path\)\) next\.add\(path\);/);
  assert.match(source, /for \(const path of \[\.\.\.next\]\)\s+if \(!visible\.has\(path\)\) next\.delete\(path\);/);
});

test('the tree tints a newly appeared file', () => {
  assert.match(source, /const \[newPaths, setNewPaths\] = React\.useState\(/);
  assert.match(
    source,
    /newPaths\?\.has\?\.\(row\.path\)[\s\S]*?color: '#1a7f37'/s,
  );
  assert.match(source, /newPaths,/);
});

test('⌘⇧T reopens the most recently closed terminal', () => {
  assert.match(source, /const closedHistoryRef = React\.useRef\(closedHistory\);/);
  assert.match(source, /if \(meta && event\.shiftKey && !event\.altKey && event\.key\.toLowerCase\(\) === 't'\) \{/);
  assert.match(source, /const recent = closedHistoryRef\.current\[0\];/);
  assert.match(source, /void reopenClosed\(recent\);/);
  /* No history means the shortcut is a no-op rather than an empty tab. */
  assert.match(source, /if \(recent === undefined\) return;/);
});

test('the new-file baseline is established on initial load, not on the first refresh', () => {
  const source = workspaceSource;
  /* Without this, the first refresh only re-baselines and reports nothing new. */
  assert.match(source, /if \(knownPathsRef\.current === null\)\s+knownPathsRef\.current = new Set\(collectFilePaths\(listing\)\);/);
  /* loadRoot must hand its listing back so refreshTree does not read a stale snapshot. */
  assert.match(source, /return listing;/);
  assert.match(source, /const listing = await loadRoot\(\);/);
});
