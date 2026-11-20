import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

const itemsStart = panel.indexOf('items: tabLayout.hidden.map((terminal) => ({');
const itemsEnd = panel.indexOf('})),\n    });', itemsStart);
const items = panel.slice(itemsStart, itemsEnd);

test('terminal overflow items own focus instead of restoring the opener', () => {
  assert.ok(itemsStart >= 0 && itemsEnd > itemsStart, 'terminal overflow items must remain present');
  assert.match(items, /restoreFocus: false/u);
  assert.match(items, /run: \(\) => \{\s+if \(splitId !== null && terminal\.id === splitId\) focusPane\('right'\);/u);
});
