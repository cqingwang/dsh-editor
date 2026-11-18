import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/terminal-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

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

test('Terminal tab menu keeps unavailable IDEA actions visible but disabled', () => {
  const terminalTabMenu = new Function(
    `'use strict';\n${extractFunction('terminalTabMenu')}\nreturn terminalTabMenu;`,
  )();
  const items = terminalTabMenu((key) => key, { id: 't1', title: 'shell', cwd: '/w' }, {
    rename: () => {},
    cycleColor: () => {},
    duplicate: () => {},
    canDuplicate: false,
    canMoveLeft: false,
    canMoveRight: false,
    moveLeft: null,
    moveRight: null,
    canCloseOthers: false,
    splitRight: null,
    reopen: null,
    moveToEditor: null,
    switchFocusToEditor: null,
    close: () => {},
    closeOthers: () => {},
  });
  const byId = new Map(items.filter(Boolean).map((entry) => [entry.id, entry]));
  assert.equal(byId.get('duplicate')?.disabled, true);
  assert.equal(byId.get('closeOthers')?.disabled, true);
  assert.equal(byId.get('reopen')?.disabled, true);
});

test('TerminalPanel derives duplicate and close-others availability from tab count', () => {
  assert.match(source, /canDuplicate: terminals\.length < 6/);
  assert.match(source, /canCloseOthers: terminals\.length > 1/);
});
