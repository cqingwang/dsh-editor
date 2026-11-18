import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = [
  await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');

test('Terminal menu exposes IDEA Page and Line scrolling actions', () => {
  const factory = new Function(
    `${transpileTypeScriptFunction(source, 'terminalMenuModel')}; return terminalMenuModel;`,
  )();
  const calls = [];
  const emulator = {
    getSelection: () => '',
    scrollPages: (count) => calls.push(['page', count]),
    scrollLines: (count) => calls.push(['line', count]),
    focus: () => calls.push(['focus']),
  };
  const model = factory({
    t: (key) => key,
    emulator,
    active: { id: 't1', state: 'running' },
    onSelectAll: () => {},
    onFind: () => {},
    onClear: () => {},
    onClearBuffer: () => {},
    onCreate: () => {},
    pasteHistory: [],
  });
  const items = model.items.filter((item) => item !== null);
  const ids = items.map((item) => item.id);
  assert.deepEqual(ids.slice(ids.indexOf('clearBuffer'), ids.indexOf('clearBuffer') + 5), [
    'clearBuffer',
    'pageUp',
    'pageDown',
    'lineUp',
    'lineDown',
  ]);
  for (const id of ['pageUp', 'pageDown', 'lineUp', 'lineDown']) {
    items.find((item) => item.id === id).run();
  }
  assert.deepEqual(calls, [
    ['page', -1],
    ['focus'],
    ['page', 1],
    ['focus'],
    ['line', -1],
    ['focus'],
    ['line', 1],
    ['focus'],
  ]);
});

test('terminal keyboard owns Shift+PageUp/PageDown for the focused pane', () => {
  const start = source.indexOf('if (\n        event.shiftKey &&');
  const shortcuts = source.slice(start, source.indexOf('const directShortcut', start));
  assert.match(shortcuts, /event\.key === 'PageUp'/);
  assert.match(shortcuts, /event\.key === 'PageDown'/);
  assert.match(shortcuts, /focusedEmulator !== null/);
  assert.match(shortcuts, /scrollPages\(event\.key === 'PageUp' \? -1 : 1\)/);
});

test('Page and Line actions are localized in both dictionaries', () => {
  assert.match(source, /terminalPageUp: '上翻一页'/);
  assert.match(source, /terminalPageDown: '下翻一页'/);
  assert.match(source, /terminalLineUp: '上移一行'/);
  assert.match(source, /terminalLineDown: '下移一行'/);
  assert.match(source, /terminalPageUp: 'Page Up'/);
  assert.match(source, /terminalPageDown: 'Page Down'/);
  assert.match(source, /terminalLineUp: 'Line Up'/);
  assert.match(source, /terminalLineDown: 'Line Down'/);
});
