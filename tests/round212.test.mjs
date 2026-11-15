import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('terminal tab move targets stop at the strip boundaries', () => {
  const terminalMoveTarget = extractFunction('terminalMoveTarget');
  const terminals = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(terminalMoveTarget(terminals, 'b', 'left'), 'a');
  assert.equal(terminalMoveTarget(terminals, 'b', 'right'), 'c');
  assert.equal(terminalMoveTarget(terminals, 'a', 'left'), null);
  assert.equal(terminalMoveTarget(terminals, 'c', 'right'), null);
  assert.equal(terminalMoveTarget(terminals, 'missing', 'left'), null);
});

test('Terminal tab menu exposes IDEA Move Tab Left/Right with boundary disable', () => {
  assert.match(source, /terminalMoveLeft: '向左移动标签',/);
  assert.match(source, /terminalMoveRight: '向右移动标签',/);
  assert.match(source, /terminalMoveLeft: 'Move Tab Left',/);
  assert.match(source, /terminalMoveRight: 'Move Tab Right',/);
  assert.match(source, /id: 'moveLeft', label: t\('editor\.terminalMoveLeft'\), disabled: actions\.canMoveLeft !== true/);
  assert.match(source, /id: 'moveRight', label: t\('editor\.terminalMoveRight'\), disabled: actions\.canMoveRight !== true/);
});

test('the tab menu computes real neighbours and reuses moveTab', () => {
  const helperStart = source.indexOf('const openTerminalTabMenu = (terminal, x, y) => {');
  assert.notEqual(helperStart, -1);
  const body = source.slice(helperStart, source.indexOf('return React.createElement(', helperStart));
  assert.match(body, /const leftTarget = terminalMoveTarget\(terminals, terminal\.id, 'left'\);/);
  assert.match(body, /const rightTarget = terminalMoveTarget\(terminals, terminal\.id, 'right'\);/);
  assert.match(body, /moveLeft: leftTarget === null \? null : \(\) => void moveTab\(terminal\.id, leftTarget\)/);
  assert.match(body, /moveRight: rightTarget === null \? null : \(\) => void moveTab\(terminal\.id, rightTarget\)/);
});
