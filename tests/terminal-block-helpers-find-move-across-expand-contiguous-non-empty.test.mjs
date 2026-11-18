import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = [
  await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8'),
  await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
].join('\n');

function bufferWith(lines) {
  return {
    length: lines.length,
    cursorY: lines.length - 1,
    cursorX: 0,
    getLine: (row) => (lines[row] === undefined ? undefined : { translateToString: () => lines[row] }),
  };
}

test('terminal block helpers find, move across, and expand contiguous non-empty ranges', () => {
  const factory = new Function(
    [
      transpileTypeScriptFunction(source, 'terminalBlockRangeAt'),
      transpileTypeScriptFunction(source, 'terminalAdjacentBlockRange'),
      transpileTypeScriptFunction(source, 'terminalExpandBlockRange'),
      'return { terminalBlockRangeAt, terminalAdjacentBlockRange, terminalExpandBlockRange };',
    ].join('\n'),
  )();
  const buffer = bufferWith(['A', 'B', '', 'C', 'D', '', 'prompt']);
  assert.deepEqual(factory.terminalBlockRangeAt(buffer, 3), { start: 3, end: 4 });
  assert.deepEqual(factory.terminalAdjacentBlockRange(buffer, { start: 3, end: 4 }, -1, 5), { start: 0, end: 1 });
  assert.equal(factory.terminalAdjacentBlockRange(buffer, { start: 3, end: 4 }, 1, 5), null);
  assert.deepEqual(factory.terminalExpandBlockRange(buffer, { start: 3, end: 4 }, -1, 5), { start: 0, end: 4 });
});

test('Terminal menu wires block above/below and expansion through selectLines', () => {
  const factory = new Function(
    [
      transpileTypeScriptFunction(source, 'terminalPromptStartRow'),
      transpileTypeScriptFunction(source, 'terminalBlockRangeAt'),
      transpileTypeScriptFunction(source, 'terminalSelectionBlockRange'),
      transpileTypeScriptFunction(source, 'terminalAdjacentBlockRange'),
      transpileTypeScriptFunction(source, 'terminalExpandBlockRange'),
      transpileTypeScriptFunction(source, 'terminalMenuModel'),
      'return terminalMenuModel;',
    ].join('\n'),
  )();
  const calls = [];
  const buffer = bufferWith(['A', 'B', '', 'C', 'D', '', 'prompt']);
  const emulator = {
    buffer: { active: buffer },
    getSelection: () => 'AB',
    getSelectionPosition: () => ({ start: { x: 0, y: 0 }, end: { x: 2, y: 1 } }),
    selectLines: (...args) => calls.push(['selectLines', ...args]),
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
  const items = model.items.filter(Boolean);
  items.find((item) => item.id === 'selectBlockBelow').run();
  items.find((item) => item.id === 'expandBlockSelectionBelow').run();
  assert.deepEqual(calls, [['selectLines', 3, 4], ['focus'], ['selectLines', 0, 4], ['focus']]);
});

test('Terminal block navigation copy is localized', () => {
  for (const [key, zh, en] of [
    ['terminalSelectBlockAbove', '选择上方命令块', 'Select Block Above'],
    ['terminalSelectBlockBelow', '选择下方命令块', 'Select Block Below'],
    ['terminalExpandBlockSelectionAbove', '向上扩展命令块选择', 'Expand Block Selection Above'],
    ['terminalExpandBlockSelectionBelow', '向下扩展命令块选择', 'Expand Block Selection Below'],
  ]) {
    assert.match(source, new RegExp(`${key}: '${zh}'`));
    assert.match(source, new RegExp(`${key}: '${en}'`));
  }
});

test('right-click preserves the current xterm selection for block actions', () => {
  assert.match(
    source,
    /screenSelectionPositionRef = React\.useRef<\{[\s\S]*?left: TerminalSelectionPosition \| null;[\s\S]*?right: TerminalSelectionPosition \| null;[\s\S]*?\}>\(\{\s+left: null,\s+right: null,\s+\}\)/,
  );
  assert.match(source, /event\.button === 2[\s\S]*?getSelectionPosition\?\.\(\)/);
  assert.match(source, /const selectionPosition = screenSelectionPositionRef\.current\[pane\] \?\? null/);
  assert.match(source, /selectionPosition,\s+onSelectAll:/);
});
