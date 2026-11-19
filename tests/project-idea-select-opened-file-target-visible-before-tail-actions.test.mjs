import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource, toolbarModelSource } from './ui-sources.mjs';
import { loadTypeScriptFunction } from './ts-source.mjs';

const projectPanelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const coreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const source = `${projectPanelSource}\n${workspaceSource}\n${coreSource}`;
const panelToolbarFit = loadTypeScriptFunction(toolbarModelSource, 'panelToolbarFit');

test('Project keeps the IDEA Select Opened File target visible before tail actions overflow', () => {
  assert.deepEqual(panelToolbarFit(201, 80.4, 2, 4, 0, 1), { left: 1, right: 2 });
  assert.deepEqual(panelToolbarFit(220, 94.5, 2, 4, 0, 1), { left: 1, right: 2 });
  assert.deepEqual(panelToolbarFit(220, 94.5, 2, 4, 0, 0), { left: 0, right: 3 });
});

test('PanelToolbar renders pinned leading actions through the shared selection policy', () => {
  assert.match(panelToolbarSource, /left\.filter\(\(action\) => action\.pinned === true\)\.length/);
  assert.match(panelToolbarSource, /const directLeft = selectCompactActions\(left, fits\.left\);/);
  assert.match(panelToolbarSource, /left\.filter\(\(action\) => directLeft\.includes\(action\) === false\)/);
  assert.match(panelToolbarSource, /directLeft\.map\(renderAction\)/);
  assert.match(toolbarModelSource, /export function selectCompactActions/);
});

test('Project target action is pinned and retains IDEA reveal semantics', () => {
  const panel = projectPanelSource;
  assert.match(panel, /titleActionStyle=\{\{\s+maxWidth: '40%',\s+\}\}/s);
  const reveal = panel.slice(panel.indexOf("id: 'reveal'"), panel.indexOf("id: 'expandSelected'"));
  assert.match(reveal, /icon: 'target'/);
  assert.match(reveal, /pinned: true/);
  assert.match(reveal, /disabled: hasActiveFile !== true/);
  assert.match(reveal, /onClick: onReveal/);
});

test('One-level Project loading remains prefetch-only and anchored on directory clicks', () => {
  const prefetchStart = coreSource.search(/async function prefetchDirectorySubtrees(?:<[^>]*>)?\(/u);
  assert.notEqual(prefetchStart, -1, 'prefetchDirectorySubtrees implementation is missing');
  const prefetchSource = coreSource.slice(prefetchStart);
  assert.match(prefetchSource, /maxDepth = 1/);
  assert.doesNotMatch(prefetchSource, /setExpanded/);
  assert.match(prefetchSource, /while \(queue\.length > 0 && visited < limit\)/);
  assert.match(prefetchSource, /item\.depth < depthLimit/);
  assert.match(coreSource, /const PROJECT_PREFETCH_DEPTH = 1;/);

  const toggle = source.slice(
    source.indexOf('const toggleDirectory = React.useCallback('),
    source.indexOf('/* Open a file, reusing its existing tab. */'),
  );
  assert.match(toggle, /void prefetchDirectorySubtrees\(\s*\[path\],/);
  assert.match(toggle, /PROJECT_PREFETCH_DEPTH/);
  assert.match(toggle, /let expandedPaths =\s+compactDirectories === true/);
  assert.match(toggle, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\)/);
  assert.doesNotMatch(toggle, /await prefetchDirectorySubtrees/);
  assert.doesNotMatch(
    toggle,
    /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.Object\.keys\(value\.children\)\]\)\)/,
  );
});
