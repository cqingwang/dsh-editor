import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let depth = 0;
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
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
  assert.match(menu, /title: batch\.length > 1 \? t\('editor\.selectionCount', \{ count: batch\.length \}\)/);
});

test('Open in Right Split accepts a batch without switching the left active document', () => {
  const open = source.slice(
    source.indexOf('const openInRightSplit = React.useCallback('),
    source.indexOf('/**\n       * Save one open model by path.'),
  );
  assert.match(open, /const requested = Array\.isArray\(target\) \? target : \[target\]/);
  assert.match(open, /const paths = \[\.\.\.new Set\(requested\.filter\(\(path\) => typeof path === 'string' && path !== ''\)\)\]/);
  assert.match(open, /for \(const path of paths\)/);
  assert.match(open, /splitTabsRef\.current\.includes\(path\) \? splitTabsRef\.current : \[\.\.\.splitTabsRef\.current, path\]/);
  assert.match(open, /setActivePath\(previous\)/);
});
