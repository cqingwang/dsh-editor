import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const parametersEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', parametersEnd);
  assert.ok(bodyStart > parametersEnd, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function bufferWith(lines) {
  const values = [...lines];
  return {
    cursorY: values.length - 1,
    cursorX: values.at(-1)?.length ?? 0,
    getLine: (row) => {
      const text = values[row];
      return text === undefined ? undefined : { translateToString: () => text };
    },
  };
}

test('Select Prompt selects the current cursor row up to caret', () => {
  const fn = new Function(`${extractFunction('terminalPromptSelection')}; return terminalPromptSelection;`)();
  const buffer = bufferWith(['output', 'user@host$ echo hello']);
  assert.deepEqual(fn(buffer, buffer.cursorY, 12), { row: 1, column: 0, length: 12 });
  assert.deepEqual(fn(buffer, 99, 50), { row: 99, column: 0, length: 50 });
});

test('Select Last Block finds the nearest contiguous non-empty output block', () => {
  const fn = new Function(`${extractFunction('terminalLastBlockSelection')}; return terminalLastBlockSelection;`)();
  const buffer = bufferWith(['old', '', 'block one', 'block two', '', 'user@host$ ']);
  assert.deepEqual(fn(buffer, buffer.cursorY), { start: 2, end: 3 });
  assert.equal(fn(bufferWith(['one', 'two'], 1), 0), null);
});

test('Terminal menu wires block and prompt selection through xterm APIs', () => {
  const factory = new Function(
    `${extractFunction('terminalPromptStartRow')}; ${extractFunction('terminalPromptSelection')}; ${extractFunction('terminalLastBlockSelection')}; ${extractFunction('terminalMenuModel')}; return terminalMenuModel;`,
  )();
  const calls = [];
  const buffer = bufferWith(['output', 'block', '', 'user@host$ ']);
  const emulator = {
    buffer: { active: buffer },
    getSelection: () => '',
    select: (...args) => calls.push(['select', ...args]),
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
  const items = model.items.filter((item) => item !== null);
  items.find((item) => item.id === 'selectLastBlock').run();
  items.find((item) => item.id === 'selectPrompt').run();
  assert.deepEqual(calls, [
    ['selectLines', 0, 1],
    ['focus'],
    ['select', 0, 3, buffer.cursorX],
    ['focus'],
  ]);
});

test('Terminal block selection copy is localized', () => {
  assert.match(source, /terminalSelectLastBlock: '选择上一命令块'/);
  assert.match(source, /terminalSelectPrompt: '选择命令行'/);
  assert.match(source, /terminalSelectLastBlock: 'Select Last Block'/);
  assert.match(source, /terminalSelectPrompt: 'Select Prompt'/);
});
