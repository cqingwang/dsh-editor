import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

const ariaIndex = panel.indexOf("aria-label={t('editor.terminalSplitPane')}");
const selectStart = panel.lastIndexOf('<select', ariaIndex);
const selectEnd = panel.indexOf('</select>', selectStart);
const select = panel.slice(selectStart, selectEnd);

test('right split pane terminal options use the stable tab-order label', () => {
  assert.ok(selectStart >= 0 && selectEnd > selectStart, 'right split pane select must remain present');
  assert.match(select, /value=\{splitId\}/u);
  assert.match(select, /terminals\s+\.filter\(\(terminal\) => terminal\.id !== activeId\)/u);
  assert.match(select, /\{terminalOverflowItemLabel\(t, terminals, terminal\)\}/u);
  assert.doesNotMatch(select, /\{terminal\.title\}/u);
});
