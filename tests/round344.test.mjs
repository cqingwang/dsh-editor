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

const directTerminalShortcut = new Function(
  `${extractFunction('directTerminalShortcut')}; return directTerminalShortcut;`,
)();

test('IDEA terminal direct shortcuts distinguish new tab, copy, and paste', () => {
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 't' }, false), 'newTab');
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'c' }, true), 'copy');
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'c' }, false), 'copyBlock');
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: false, key: 'v' }, false), 'paste');
});

test('Ctrl+C remains an interrupt and shifted clipboard shortcuts keep their existing path', () => {
  assert.equal(directTerminalShortcut({ metaKey: false, ctrlKey: true, altKey: false, shiftKey: false, key: 'c' }, true), null);
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: 'c' }, true), null);
  assert.equal(directTerminalShortcut({ metaKey: true, ctrlKey: false, altKey: false, shiftKey: true, key: 'v' }, false), null);
});

test('terminal keyboard handler wires direct shortcuts to the focused pane', () => {
  const handler = source.slice(
    source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;"),
    source.indexOf('/* ⌘⇧T reopens the most recently closed terminal', source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;")),
  );
  assert.match(handler, /const directShortcut = directTerminalShortcut\(/);
  assert.match(handler, /directShortcut === 'newTab'/);
  assert.match(handler, /directShortcut === 'copy'/);
  assert.match(handler, /directShortcut === 'paste'/);
  assert.match(handler, /document\.activeElement\?\.closest\('\[data-dsh-terminal-pane\]'\)/);
});

test('terminal New action advertises IDEA ⌘T', () => {
  const menu = extractFunction('terminalMenuModel');
  assert.match(menu, /\{ id: 'new', label: t\('editor\.terminalNew'\), shortcut: '⌘T', run: onCreate \}/);
});
