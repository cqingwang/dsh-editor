import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const plain = source.indexOf(`    function ${name}(`);
  const asynchronous = source.indexOf(`    async function ${name}(`);
  const start = plain >= 0 ? plain : asynchronous;
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

const panelToolbarFit = new Function(
  `${extractFunction('panelToolbarFit')}; return panelToolbarFit;`,
)();

test('Project keeps the IDEA Select Opened File target visible before tail actions overflow', () => {
  assert.deepEqual(panelToolbarFit(220, 94.5, 2, 4, 0, 1), { left: 1, right: 2 });
  assert.deepEqual(panelToolbarFit(220, 94.5, 2, 4, 0, 0), { left: 0, right: 3 });
});

test('PanelToolbar renders pinned leading actions through the shared selection policy', () => {
  const toolbar = source.slice(
    source.indexOf('function PanelToolbar('),
    source.indexOf('/** One 24px panel toolbar button. */'),
  );
  assert.match(toolbar, /left\.filter\(\(action\) => action\.pinned === true\)\.length/);
  assert.match(toolbar, /const directLeft = selectCompactActions\(left, fits\.left\);/);
  assert.match(toolbar, /left\.filter\(\(action\) => directLeft\.includes\(action\) === false\)/);
  assert.match(toolbar, /directLeft\.map\(renderAction\)/);
});

test('Project target action is pinned and retains IDEA reveal semantics', () => {
  const panel = source.slice(
    source.indexOf('function ProjectPanel('),
    source.indexOf('/**\n     * IDEA-style context menu'),
  );
  assert.match(panel, /titleActionStyle: \{ maxWidth: '68%' \}/);
  const reveal = panel.slice(panel.indexOf("id: 'reveal'"), panel.indexOf("id: 'expandSelected'"));
  assert.match(reveal, /icon: 'target'/);
  assert.match(reveal, /pinned: true/);
  assert.match(reveal, /disabled: hasActiveFile !== true/);
  assert.match(reveal, /onClick: onReveal/);
});

test('One-level Project loading remains prefetch-only and anchored on directory clicks', () => {
  const prefetch = extractFunction('prefetchDirectorySubtrees');
  assert.match(prefetch, /maxDepth = 1/);
  assert.doesNotMatch(prefetch, /setExpanded/);
  assert.match(prefetch, /while \(queue\.length > 0 && visited < limit\)/);
  assert.match(prefetch, /item\.depth < depthLimit/);
  assert.match(source, /const PROJECT_PREFETCH_DEPTH = 1;/);

  const toggle = source.slice(
    source.indexOf('const toggleDirectory = React.useCallback(async (path) => {'),
    source.indexOf('/* Open a file, reusing its existing tab. */'),
  );
  assert.match(toggle, /void prefetchDirectorySubtrees\(\s*\[path\],/);
  assert.match(toggle, /PROJECT_PREFETCH_DEPTH/);
  assert.match(toggle, /let expandedPaths = compactDirectories === true/);
  assert.match(toggle, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\)/);
  assert.doesNotMatch(toggle, /await prefetchDirectorySubtrees/);
  assert.doesNotMatch(toggle, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.Object\.keys\(value\.children\)\]\)\)/);
});
