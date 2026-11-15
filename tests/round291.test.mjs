import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

test('terminal menu sends IDEA search-history shortcut through xterm input', () => {
  const terminalMenuModel = new Function(
    `'use strict';\n${extractFunction('terminalMenuModel')}\nreturn terminalMenuModel;`,
  )();
  let input = '';
  let focused = 0;
  const menu = terminalMenuModel({
    t: (key) => key,
    emulator: {
      getSelection: () => '',
      input: (data, wasUserInput) => {
        input = `${data}:${wasUserInput}`;
      },
      focus: () => { focused += 1; },
    },
    active: null,
    onSelectAll: () => {},
    onFind: () => {},
    onClear: () => {},
    onClearBuffer: () => {},
    onCreate: () => {},
    onSplitRight: null,
    onMoveToEditor: null,
    onSwitchFocusToEditor: null,
    onClipboardError: () => {},
    onPastedText: () => {},
    pasteHistory: [],
    onPasteHistory: () => {},
  });
  const item = menu.items.find((entry) => entry?.id === 'searchHistory');
  assert.ok(item, 'searchHistory item is missing');
  assert.equal(item.label, 'editor.terminalSearchHistory');
  assert.equal(item.shortcut, '⌃R');
  assert.equal(item.restoreFocus, false);
  item.run();
  assert.equal(input, '\u0012:true');
  assert.equal(focused, 1);
});

test('search-history wording exists in both dictionaries', () => {
  assert.ok(source.split('terminalSearchHistory:').length - 1 >= 2);
});
