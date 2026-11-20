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

function bufferWith(rows, cursorX = 0) {
  return {
    cursorY: rows.length - 1,
    cursorX,
    getLine: (row) => {
      const entry = rows[row];
      if (entry === undefined) return undefined;
      const text = typeof entry === 'string' ? entry : entry.text;
      return {
        isWrapped: typeof entry === 'object' && entry.wrapped === true,
        translateToString: () => text,
      };
    },
  };
}

test('wrapped prompt selection walks back through xterm continuation rows', () => {
  const fn = new Function(
    `${extractFunction('terminalAbsoluteCursorRow')}; ${extractFunction('terminalPromptStartRow')}; return terminalPromptStartRow;`,
  )();
  const buffer = bufferWith([
    'old output',
    { text: '(base) prompt', wrapped: false },
    { text: 'continued prompt', wrapped: true },
    { text: 'tail ✗ ', wrapped: true },
  ]);
  assert.equal(fn(buffer), 1);
  assert.equal(fn(buffer, 2), 1);
  assert.equal(fn(buffer, 0), 0);
  assert.equal(fn(null), null);
});

test('Terminal menu exposes IDEA Copy Block through the last block helper', () => {
  const factory = new Function(
    `${extractFunction('terminalAbsoluteCursorRow')}; ${extractFunction('terminalLastBlockSelection')}; ${extractFunction('terminalMenuModel')}; return terminalMenuModel;`,
  )();
  const calls = [];
  const buffer = bufferWith(['', 'BLOCK', '']);
  const emulator = {
    buffer: { active: buffer },
    getSelection: () => 'BLOCK',
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
  const item = model.items.filter(Boolean).find((entry) => entry.id === 'copyBlock');
  assert.ok(item);
  item.run();
  assert.deepEqual(calls, [
    ['selectLines', 1, 1],
    ['focus'],
  ]);
});

test('Meta/Ctrl Up and Down use the same block and wrapped-prompt selections', () => {
  const handler = source.slice(
    source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;"),
    source.indexOf('const directShortcut', source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;")),
  );
  assert.match(handler, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(handler, /event\.key === 'ArrowUp'/);
  assert.match(handler, /event\.key === 'ArrowDown'/);
  assert.match(handler, /terminalLastBlockSelection\(focusedEmulator\.buffer\?\.active\)/);
  assert.match(handler, /terminalPromptStartRow\(focusedEmulator\.buffer\?\.active/);
  assert.match(handler, /focusedEmulator\.selectLines/);
  assert.match(handler, /focusedEmulator\.select\?\.\(/);
});

test('Copy Block and prompt shortcut copy are localized', () => {
  assert.match(source, /terminalCopyBlock: '复制命令块'/);
  assert.match(source, /terminalCopyBlock: 'Copy Block'/);
});
