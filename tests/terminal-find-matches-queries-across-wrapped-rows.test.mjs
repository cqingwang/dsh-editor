import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const { countTerminalMatches, moveTerminalSelection, terminalMatches } = loadTypeScriptModule(source, [
  'countTerminalMatches',
  'moveTerminalSelection',
  'terminalMatches',
]);

const rows = [
  { text: 'prompt SPLIT_RIGHT_', wrapped: false },
  { text: 'TOKEN_42 output', wrapped: true },
  { text: 'again SPLIT_RIGHT_', wrapped: false },
  { text: 'TOKEN_42', wrapped: true },
];

function fakeEmulator() {
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

test('Terminal Find matches a query split across wrapped rows', () => {
  const emulator = fakeEmulator();
  assert.deepEqual(terminalMatches(emulator, 'SPLIT_RIGHT_TOKEN_42'), [
    { row: 0, column: 7 },
    { row: 2, column: 6 },
  ]);
  assert.equal(countTerminalMatches(emulator, 'SPLIT_RIGHT_TOKEN_42'), 2);
});

test('Terminal Find navigates to the first physical row of a wrapped match', () => {
  const emulator = fakeEmulator();
  const states = [];
  moveTerminalSelection(
    emulator,
    { query: 'SPLIT_RIGHT_TOKEN_42', index: -1, total: 2 },
    (state) => states.push(state),
    1,
  );
  assert.deepEqual(emulator.selected, [{ column: 7, row: 0, length: 'SPLIT_RIGHT_TOKEN_42'.length }]);
  assert.deepEqual(states, [{ query: 'SPLIT_RIGHT_TOKEN_42', index: 0, total: 2 }]);
});
