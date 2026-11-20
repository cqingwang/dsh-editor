import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const { moveTerminalSelection, terminalMatches } = loadTypeScriptModule(source, [
  'moveTerminalSelection',
  'terminalMatches',
]);

function fakeEmulator(rows) {
  const selected = [];
  return {
    buffer: {
      active: {
        length: rows.length,
        getLine: (row) =>
          rows[row] === undefined
            ? undefined
            : {
                isWrapped: rows[row].wrapped,
                translateToString: () => rows[row].text,
              },
      },
    },
    rows: 12,
    select: (column, row, length) => selected.push({ column, row, length }),
    scrollToLine: () => {},
    selected,
  };
}

test('wide characters map to terminal cell columns instead of JS offsets', () => {
  const emulator = fakeEmulator([
    { text: '中文AB', wrapped: false },
    { text: '测试CD', wrapped: true },
  ]);
  assert.deepEqual(terminalMatches(emulator, 'AB测试'), [{ row: 0, column: 4 }]);
});

test('a wide-character match selects its full terminal cell width', () => {
  const emulator = fakeEmulator([
    { text: '中文AB', wrapped: false },
    { text: '测试CD', wrapped: true },
  ]);
  const states = [];
  moveTerminalSelection(
    emulator,
    { query: 'AB测试', index: -1, total: 1 },
    (state) => states.push(state),
    1,
  );
  assert.deepEqual(emulator.selected, [{ column: 4, row: 0, length: 6 }]);
  assert.deepEqual(states, [{ query: 'AB测试', index: 0, total: 1 }]);
});

test('emoji columns account for earlier CJK cell widths', () => {
  const emulator = fakeEmulator([{ text: '中文😀tail', wrapped: false }]);
  assert.deepEqual(terminalMatches(emulator, '😀'), [{ row: 0, column: 4 }]);
});

test('multiple CJK matches keep buffer order and cycle in both directions', () => {
  const emulator = fakeEmulator([
    { text: '中文AB测试CD', wrapped: false },
    { text: '中文XY测试ZW', wrapped: false },
  ]);
  assert.deepEqual(terminalMatches(emulator, '测试'), [
    { row: 0, column: 6 },
    { row: 1, column: 6 },
  ]);
  const states = [];
  moveTerminalSelection(
    emulator,
    { query: '测试', index: 0, total: 2 },
    (state) => states.push(state),
    1,
  );
  moveTerminalSelection(
    emulator,
    { query: '测试', index: 1, total: 2 },
    (state) => states.push(state),
    1,
  );
  assert.deepEqual(emulator.selected, [
    { column: 6, row: 1, length: 4 },
    { column: 6, row: 0, length: 4 },
  ]);
  assert.deepEqual(states, [
    { query: '测试', index: 1, total: 2 },
    { query: '测试', index: 0, total: 2 },
  ]);
});
