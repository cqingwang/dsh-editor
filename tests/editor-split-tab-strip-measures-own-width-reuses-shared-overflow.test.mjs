import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const splitHeaderSource = readFileSync(join(root, 'src/client/components/editor/EditorSplitHeader.tsx'), 'utf8');

test('split tab strip measures its own width and reuses the shared overflow helper', () => {
  assert.match(source, /const \[splitTabStripWidth, setSplitTabStripWidth\] = React\.useState\(0\)/);
  assert.match(source, /const splitTabStripRef = React\.useRef\(null\)/);
  assert.match(source, /splitTabStripRef\.current/);
  assert.match(source, /setSplitTabStripWidth\(node\.clientWidth\)/);
  assert.match(source, /const splitTabLayout = overflowTabs\(splitTabs, visibleTabCount\(splitTabStripWidth, splitTabs\.length\), splitPath, \(path\) => path\)/);
});

test('only fitting split tabs render and the active tab stays visible', () => {
  assert.match(source, /splitTabLayout\.visible\.map\(\(splitTab\) => \{/);
  assert.match(splitHeaderSource, /data-dsh-editor-split-hidden-tabs=\{String\(hiddenCount\)\}/);
  assert.match(source, /fileTabLayout\.hidden/);
  assert.match(source, /splitTabLayout\.hidden\.length === 0/);
});

test('split overflow menu activates a hidden tab without rebuilding the editor', () => {
  const start = source.indexOf('onOverflow: (event) => {');
  const overflow = source.slice(start, source.indexOf('onCloseSplit: closeRightSplit', start));
  assert.match(splitHeaderSource, /title=\{t\('editor\.tabsOverflow', \{ count: hiddenCount \}\)\}/);
  assert.match(overflow, /items: splitTabLayout\.hidden\.map\(\(path\) =>/);
  assert.match(overflow, /splitPathRef\.current = path/);
  assert.match(overflow, /setSplitPath\(path\)/);
  assert.doesNotMatch(overflow, /createCodeEditorGroup\(/);
});

test('the whole-split close remains outside the overflow list', () => {
  const tabsAt = source.indexOf("'data-dsh-editor-split-tabs': ''");
  assert.ok(tabsAt >= 0);
  assert.match(source, /onCloseSplit: closeRightSplit/);
  assert.match(splitHeaderSource, /aria-label=\{t\('editor\.closeSplit'\)\}/);
  assert.match(splitHeaderSource, /onClick=\{onCloseSplit\}/);
});
