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

test('empty paste history stays visible but disabled', () => {
  const terminalMenuModel = new Function(
    `'use strict';\n${extractFunction('terminalMenuModel')}\nreturn terminalMenuModel;`,
  )();
  const menu = terminalMenuModel({
    t: (key) => key,
    emulator: { getSelection: () => '' },
    active: { id: 't1', state: 'running' },
    onSelectAll: () => {},
    onFind: () => {},
    onClose: () => {},
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
  const pasteHistory = menu.items.find((entry) => entry?.id === 'pasteHistory');
  assert.ok(pasteHistory);
  assert.equal(pasteHistory.disabled, true);
});
