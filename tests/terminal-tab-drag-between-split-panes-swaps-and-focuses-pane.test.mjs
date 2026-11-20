import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('dragging the active left tab into the right pane swaps the split terminals', () => {
  assert.match(
    panel,
    /if \(pane === 'right'\) \{[\s\S]*?if \(terminalId === activeId\) \{[\s\S]*?if \(splitId !== null\) \{\s+setActiveId\(splitId\);\s+setSplitId\(terminalId\);\s+setFocusedPane\('right'\);\s+window\.setTimeout\(\(\) => splitEmulatorRef\.current\?\.focus\?\.\(\), 0\);\s+\}\s+return;/u,
  );
});

test('pane drops suppress the drag-end focus steal and leave keyboard focus in the target terminal', () => {
  assert.match(panel, /const dragDroppedInPaneRef = React\.useRef\(false\);/u);
  assert.match(
    panel,
    /const paneDragFinished = dragDroppedInPaneRef\.current;\s+dragDroppedInPaneRef\.current = false;\s+if \(!paneDragFinished\) event\.currentTarget\.focus\?\.\(\);/u,
  );
  assert.match(
    panel,
    /onDrop=\{\(event\) => \{\s+event\.preventDefault\(\);\s+const source = event\.dataTransfer\?\.getData\('text\/plain'\) \?\? '';\s+if \(source !== ''\) \{\s+dragDroppedInPaneRef\.current = true;\s+moveToPane\(source, 'left'\);/s,
  );
  assert.match(
    panel,
    /onDrop=\{\(event\) => \{\s+event\.preventDefault\(\);\s+const source = event\.dataTransfer\?\.getData\('text\/plain'\) \?\? '';\s+if \(source !== ''\) \{\s+dragDroppedInPaneRef\.current = true;\s+moveToPane\(source, 'right'\);/s,
  );
  assert.match(
    panel,
    /if \(pane === 'right'\) \{[\s\S]*?window\.setTimeout\(\(\) => splitEmulatorRef\.current\?\.focus\?\.\(\), 0\);/u,
  );
  assert.match(
    panel,
    /setActiveId\(terminalId\);\s+setFocusedPane\('left'\);\s+window\.setTimeout\(\(\) => emulatorRef\.current\?\.focus\?\.\(\), 0\);/u,
  );
});
