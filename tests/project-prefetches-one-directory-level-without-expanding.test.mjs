import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const projectSource = await readFile(new URL('../src/client/project.ts', import.meta.url), 'utf8');
const prefetchDirectorySubtrees = loadTypeScriptFunction(coreSource, 'prefetchDirectorySubtrees');
const compactDirectoryExpansionPaths = loadTypeScriptFunction(projectSource, 'compactDirectoryExpansionPaths');

test('Project prefetches one directory level without expanding it', async () => {
  const listings = {
    a: [{ path: 'a/b', kind: 'directory' }],
    'a/b': [{ path: 'a/b/c', kind: 'directory' }],
    'a/b/c': [{ path: 'a/b/c/d', kind: 'directory' }],
    'a/b/c/d': [{ path: 'a/b/c/d/file.ts', kind: 'file' }],
  };
  const calls = [];
  const result = await prefetchDirectorySubtrees(
    ['a'],
    { children: {} },
    async (path) => {
      calls.push(path);
      return listings[path] ?? [];
    },
    200,
    1,
  );
  assert.deepEqual(calls, ['a']);
  assert.deepEqual(Object.keys(result.children), ['a']);
  assert.equal(result.children['a/b'], undefined);
  assert.equal('expanded' in result, false);
});

test('A clicked directory anchors background prefetch without waiting for it', () => {
  const toggle = source.slice(
    source.indexOf('const toggleDirectory = React.useCallback('),
    source.indexOf('/* Open a file, reusing its existing tab. */'),
  );
  assert.match(toggle, /const willExpand = !expanded\.has\(path\)/);
  assert.match(toggle, /void prefetchDirectorySubtrees\(\s*\[path\],/);
  assert.match(toggle, /PROJECT_PREFETCH_DEPTH/);
  assert.match(toggle, /let expandedPaths =\s+compactDirectories === true/);
  assert.match(toggle, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\)/);
  assert.doesNotMatch(toggle, /await prefetchDirectorySubtrees/);
  assert.doesNotMatch(toggle, /setExpanded\(value\.expanded\)/);
});

test('Startup prefetch fills children but leaves the visible expansion tree collapsed', () => {
  assert.match(coreSource, /const PROJECT_PREFETCH_DEPTH = 1;/);
  assert.match(coreSource, /const PROJECT_PREFETCH_VISIT_LIMIT = 200;/);
  const root = source.slice(
    source.indexOf('const loadRoot = React.useCallback'),
    source.indexOf('void loadRoot();'),
  );
  assert.match(root, /prefetchedRootRef\.current !== workspaceRoot/);
  assert.match(root, /prefetchDirectorySubtrees\([\s\S]*?PROJECT_PREFETCH_DEPTH/);
  assert.doesNotMatch(root, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.prefetched/);
  assert.doesNotMatch(root, /writeExpanded\(workspaceRoot, prefetched/);
});

test('Compact Directories resolves one continuous chain before and after refresh', () => {
  const toggle = source.slice(
    source.indexOf('const toggleDirectory = React.useCallback('),
    source.indexOf('/* Open a file, reusing its existing tab. */'),
  );
  assert.match(toggle, /compactDirectories === true/);
  assert.match(toggle, /compactDirectoryExpansionPaths\(path, childrenRef\.current\)/);
  assert.match(toggle, /compactDirectoryExpansionPaths\(path, mergedChildren\)/);

  const children = {
    a: [{ path: 'a/b', kind: 'directory' }],
    'a/b': [{ path: 'a/b/c', kind: 'directory' }],
    'a/b/c': [{ path: 'a/b/c/d', kind: 'directory' }],
  };
  assert.deepEqual(compactDirectoryExpansionPaths('a', children), ['a', 'a/b', 'a/b/c', 'a/b/c/d']);
});
