import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const splitHeaderSource = readFileSync(join(root, 'src/client/components/editor/EditorSplitHeader.tsx'), 'utf8');
const findToolSource = readFileSync(join(root, 'src/client/find-tool.ts'), 'utf8');

test('split tab strip measures its own width and reuses the shared overflow helper', () => {
  const visibleTabCount = loadTypeScriptFunction(findToolSource, 'visibleTabCount');
  const overflowTabs = loadTypeScriptFunction(findToolSource, 'overflowTabs');
  assert.equal(visibleTabCount(130, 8), 1);
  assert.ok(visibleTabCount(600, 8) > visibleTabCount(130, 8));
  assert.ok(visibleTabCount(600, 8) <= 8);
  assert.ok(visibleTabCount(0, 8) >= 1);
  const layout = overflowTabs(['a.ts', 'b.ts', 'c.ts'], 2, 'b.ts', (path) => path);
  assert.deepEqual(layout.visible, ['a.ts', 'b.ts']);
  assert.ok(layout.visible.includes('b.ts'));
  assert.deepEqual(layout.hidden, ['c.ts']);
});

test('only fitting split tabs render and the active tab stays visible', () => {
  assert.match(source, /splitTabLayout\.visible\.map\(\(splitTab\) => \{/);
  assert.match(splitHeaderSource, /data-dsh-editor-split-hidden-tabs=\{String\(hiddenCount\)\}/);
  assert.match(source, /fileTabLayout\.hidden/);
  assert.match(source, /splitTabLayout\.hidden\.length === 0/);
});

test('split overflow menu activates a hidden tab without rebuilding the editor', () => {
  assert.match(splitHeaderSource, /title=\{t\('editor\.tabsOverflow', \{ count: hiddenCount \}\)\}/);
  const overflowStart = source.indexOf('items: splitTabLayout.hidden.map');
  const overflow = source.slice(overflowStart, source.indexOf('onCloseSplit=', overflowStart));
  assert.match(overflow, /splitTabLayout\.hidden\.map\(\(path\) => \{/);
  assert.match(overflow, /splitPathRef\.current = path;\s+setSplitPath\(path\);/);
  assert.doesNotMatch(overflow, /createCodeEditorGroup\(/);
});

test('the whole-split close remains outside the overflow list', () => {
  assert.match(splitHeaderSource, /data-dsh-editor-split-tabs=''/);
  assert.match(source, /onCloseSplit=\{closeRightSplit\}/);
  assert.match(splitHeaderSource, /aria-label=\{t\('editor\.closeSplit'\)\}/);
  assert.match(splitHeaderSource, /onClick=\{onCloseSplit\}/);
});
