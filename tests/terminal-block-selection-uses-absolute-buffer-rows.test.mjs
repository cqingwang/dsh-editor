import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, [
  'terminalAdjacentBlockRange',
  'terminalLastBlockSelection',
  'terminalPromptSelection',
  'terminalPromptStartRow',
  'terminalSelectionBlockRange',
]);

function scrolledBuffer() {
  const lines = [
    ['previous output', false],
    ['old prompt', false],
    ['old output', false],
    ['old prompt 2', false],
    ['old output 2', false],
    ['old prompt 3', false],
    ['old output 3', false],
    ['old prompt 4', false],
    ['old output 4', false],
    ['visible prompt', false],
    ['command wrap 1', true],
    ['command wrap 2', true],
    ['command wrap 3', true],
    ['block-one-a', false],
    ['block-one-b', false],
    ['', false],
    ['block-two-a', false],
    ['block-two-b', false],
    ['prompt row 1', false],
    ['prompt row 2', true],
  ];
  return {
    baseY: 8,
    viewportY: 8,
    cursorX: 8,
    cursorY: 11,
    length: lines.length,
    getLine: (row) =>
      lines[row] === undefined
        ? undefined
        : {
            isWrapped: lines[row][1],
            translateToString: () => lines[row][0],
          },
  };
}

test('block helpers convert viewport cursorY into absolute buffer rows', () => {
  const buffer = scrolledBuffer();
  assert.equal(helpers.terminalPromptStartRow(buffer), 18);
  assert.deepEqual(helpers.terminalPromptSelection(buffer), { row: 19, column: 0, length: 8 });
  assert.deepEqual(helpers.terminalLastBlockSelection(buffer), { start: 16, end: 17 });
});

test('a scrolled selection still finds the adjacent block above', () => {
  const buffer = scrolledBuffer();
  const selected = helpers.terminalSelectionBlockRange(buffer, {
    start: { x: 0, y: 15 },
    end: { x: 6, y: 16 },
  });
  assert.deepEqual(selected, { start: 16, end: 17 });
  assert.deepEqual(helpers.terminalAdjacentBlockRange(buffer, selected, -1, 17), { start: 0, end: 14 });
});
