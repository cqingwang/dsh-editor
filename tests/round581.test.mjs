import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Terminal block keyboard mode requires a block selection and closed Find', () => {
  const fn = new Function(`${extractFunction('terminalBlockKeyboardAction')}; return terminalBlockKeyboardAction;`)();
  const plain = { key: 'ArrowUp', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false };
  const shifted = { ...plain, key: 'ArrowDown', shiftKey: true };
  assert.equal(fn(plain, false, false), null);
  assert.equal(fn(plain, true, true), null);
  assert.equal(fn(plain, true, false), 'selectAbove');
  assert.equal(fn({ ...plain, key: 'ArrowDown' }, true, false), 'selectBelow');
  assert.equal(fn(shifted, true, false), 'expandBelow');
  assert.equal(fn({ ...shifted, key: 'ArrowUp' }, true, false), 'expandAbove');
  assert.equal(fn({ ...plain, altKey: true }, true, false), null);
});

test('Terminal keyboard handler reuses adjacent and expand block helpers', () => {
  const handler = source.slice(
    source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;"),
    source.indexOf("if (\n            meta\n            && !event.altKey", source.indexOf("if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;")),
  );
  assert.match(handler, /const blockAction = terminalBlockKeyboardAction\(event, selection !== '', findRef\.current !== null\);/);
  assert.match(handler, /terminalSelectionBlockRange\(buffer, focusedEmulator\.getSelectionPosition/);
  assert.match(handler, /terminalAdjacentBlockRange\(buffer, blockRange/);
  assert.match(handler, /terminalExpandBlockRange\(buffer, blockRange/);
  assert.match(handler, /focusedEmulator\.selectLines\?\.\(range\.start, range\.end\)/);
});
