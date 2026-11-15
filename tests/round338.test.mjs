import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('split tab strip measures its own width and reuses the shared overflow helper', () => {
  assert.match(source, /const \[splitTabStripWidth, setSplitTabStripWidth\] = React\.useState\(0\)/);
  assert.match(source, /const splitTabStripRef = React\.useRef\(null\)/);
  assert.match(source, /splitTabStripRef\.current/);
  assert.match(source, /setSplitTabStripWidth\(node\.clientWidth\)/);
  assert.match(source, /const splitTabLayout = overflowTabs\(splitTabs, visibleTabCount\(splitTabStripWidth, splitTabs\.length\), splitPath, \(path\) => path\)/);
});

test('only fitting split tabs render and the active tab stays visible', () => {
  assert.match(source, /splitTabLayout\.visible\.map\(\(splitTab\) => \{/);
  assert.match(source, /'data-dsh-editor-split-hidden-tabs': String\(splitTabLayout\.hidden\.length\)/);
  assert.match(source, /fileTabLayout\.hidden/);
  assert.match(source, /splitTabLayout\.hidden\.length === 0/);
});

test('split overflow menu activates a hidden tab without rebuilding the editor', () => {
  const strip = source.slice(
    source.indexOf("'data-dsh-editor-split-tabs': ''"),
    source.indexOf('React.createElement(\n                          \'button\',\n                          {\n                            type: \'button\',\n                            style: styles.tabClose,', source.indexOf("'data-dsh-editor-split-tabs': ''")),
  );
  assert.match(strip, /title: t\('editor\.tabsOverflow', \{ count: splitTabLayout\.hidden\.length \}\)/);
  assert.match(strip, /items: splitTabLayout\.hidden\.map\(\(path\) =>/);
  assert.match(strip, /splitPathRef\.current = path/);
  assert.match(strip, /setSplitPath\(path\)/);
  assert.doesNotMatch(strip, /createCodeEditorGroup\(/);
});

test('the whole-split close remains outside the overflow list', () => {
  const tabsAt = source.indexOf("'data-dsh-editor-split-tabs': ''");
  const wholeCloseAt = source.indexOf("'aria-label': t('editor.closeSplit')", tabsAt);
  assert.ok(wholeCloseAt > tabsAt);
  assert.match(source.slice(wholeCloseAt - 160, wholeCloseAt + 260), /onClick: closeRightSplit/);
});
