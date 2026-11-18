import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const cssSource = readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8');
const shouldShowTreeLoading = loadTypeScriptFunction(cssSource, 'shouldShowTreeLoading');

test('the tree shows the placeholder only before it has any rows', () => {
  /* The 4s poll re-ran the loader, and the placeholder row pushed the whole tree
     down 22px and back: the list visibly jumped on every refresh. */
  assert.equal(shouldShowTreeLoading({ loading: true, rowCount: 0 }), true);
  assert.equal(shouldShowTreeLoading({ loading: true, rowCount: 12 }), false);
  assert.equal(shouldShowTreeLoading({ loading: false, rowCount: 0 }), false);
  assert.equal(shouldShowTreeLoading(null), false);
});

test('the placeholder is no longer keyed off the raw loading flag', () => {
  const start = projectPanelSource.indexOf('shouldShowTreeLoading({');
  assert.notEqual(start, -1, 'the placeholder must go through the helper');
  const block = projectPanelSource.slice(start, start + 260);
  assert.match(block, /t\('editor\.loading'\)/);
  assert.doesNotMatch(projectPanelSource, /\{loading \? \(\s*<TreeMessage[^>]*state='loading'/u);
});

test('a refresh keeps the current rows on screen while it loads', () => {
  /* `loadRoot` must not flip the loading flag off when data already exists. */
  const start = workspaceSource.indexOf('const loadRoot = React.useCallback(');
  assert.notEqual(start, -1);
  const block = workspaceSource.slice(start, start + 500);
  assert.match(block, /shouldShowTreeLoading\(/);
  assert.match(block, /rowCount: treeRootRef\.current === '' \? 0 : rowsRef\.current\.length/u);
});

test('a workspace switch shows the placeholder again', () => {
  /* The previous root's rows say nothing about the new one; keeping the silent path
     there would show a stale tree with no hint that a load is in flight. */
  const start = workspaceSource.indexOf('const loadRoot = React.useCallback(');
  const block = workspaceSource.slice(start, start + 800);
  assert.match(block, /treeRootRef\.current/);
  const setter = workspaceSource.indexOf("treeRootRef.current = value.root ?? '';");
  assert.notEqual(setter, -1, 'the loaded root must be recorded for the next decision');
});

test('rowsRef mirrors the project tree rows for the loader', () => {
  assert.match(workspaceSource, /const rowsRef = React\.useRef(?:<[^>]+>)?\(\[\]\);/);
  assert.match(workspaceSource, /rowsRef\.current = projectRows;/);
});
