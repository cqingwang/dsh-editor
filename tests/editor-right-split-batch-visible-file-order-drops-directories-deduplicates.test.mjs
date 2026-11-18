import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const source = workspaceSource + '\n' + terminalSource;

function extractFunction(name) {
  return transpileTypeScriptFunction(terminalSource, name);
}

const projectRightSplitPaths = new Function(
  `${extractFunction('projectRightSplitPaths')}; return projectRightSplitPaths;`,
)();

test('right split batch keeps visible file order, drops directories and deduplicates', () => {
  const rows = [
    { path: '', name: 'project', kind: 'directory' },
    { path: 'docs', name: 'docs', kind: 'directory' },
    { path: 'docs/b.md', name: 'b.md', kind: 'file' },
    { path: 'docs/a.txt', name: 'a.txt', kind: 'file' },
    { path: 'docs/a.txt', name: 'a.txt', kind: 'file' },
    { path: 'src', name: 'src', kind: 'directory' },
    { path: 'src/c.ts', name: 'c.ts', kind: 'file' },
  ];
  const selection = new Set(['docs', 'docs/a.txt', 'docs/b.md', 'src']);
  assert.deepEqual(projectRightSplitPaths(rows, selection, 'docs/a.txt'), ['docs/b.md', 'docs/a.txt']);
  assert.deepEqual(projectRightSplitPaths(rows, selection, 'docs/b.md'), ['docs/b.md', 'docs/a.txt']);
});

test('right-click outside the multi-selection opens only the clicked file', () => {
  const rows = [
    { path: 'a.txt', kind: 'file' },
    { path: 'b.txt', kind: 'file' },
    { path: 'c.txt', kind: 'file' },
    { path: 'docs', kind: 'directory' },
  ];
  assert.deepEqual(projectRightSplitPaths(rows, new Set(['a.txt', 'b.txt']), 'docs'), []);
  assert.deepEqual(projectRightSplitPaths(rows, new Set(['a.txt', 'b.txt']), 'c.txt'), ['c.txt']);
  assert.deepEqual(projectRightSplitPaths(rows, new Set(['a.txt']), 'a.txt'), ['a.txt']);
});

test('Project menu opens every selected file through the ordered batch action', () => {
  const menu = source.slice(
    source.indexOf('const buildTreeMenu = React.useCallback('),
    source.indexOf('/* Move one entry into a directory by drag-and-drop'),
  );
  assert.match(menu, /const splitCandidates = projectRightSplitPaths\(rows, selection, row\.path\)/);
  assert.match(menu, /disabled: isRoot \|\| splitCandidates\.length === 0/);
  assert.match(menu, /openInRightSplit\(splitCandidates\)/);
  assert.match(menu, /title:\s*batch\.length > 1 \? t\('editor\.selectionCount', \{ count: batch\.length \}\) : null/);
});

test('Open in Right Split accepts a batch without switching the left active document', () => {
  const open = source.slice(
    source.indexOf('const openInRightSplit ='),
    source.indexOf('const savePath ='),
  );
  assert.match(open, /const requested = Array\.isArray\(target\) \? target : \[target\]/);
  assert.match(open, /const paths = \[\.\.\.new Set\(requested\.filter\(\(path\) => typeof path === 'string' && path !== ''\)\)\]/);
  assert.match(open, /for \(const path of paths\)/);
  assert.match(open, /splitTabsRef\.current\.includes\(path\)\s+\? splitTabsRef\.current\s+: \[\.\.\.splitTabsRef\.current, path\]/);
  assert.match(open, /setActivePath\(previous\)/);
});
