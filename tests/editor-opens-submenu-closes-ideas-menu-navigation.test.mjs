import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/ui/Menu.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

/** Evaluate one shipping helper by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const submenuKeyAction = load('submenuKeyAction');

test('→ opens a submenu and ← closes it, IDEA\'s menu navigation', () => {
  assert.equal(submenuKeyAction('ArrowRight', { hasChildren: true, open: false }), 'open');
  assert.equal(submenuKeyAction('ArrowRight', { hasChildren: true, open: true }), 'first-child');
  assert.equal(submenuKeyAction('ArrowLeft', { hasChildren: true, open: true }), 'close');
  /* ← on a leaf inside a submenu goes back to the parent level. */
  assert.equal(submenuKeyAction('ArrowLeft', { hasChildren: false, open: false }), 'back');
});

test('Esc closes one level, not the whole menu', () => {
  /* With a child open, Esc must return to the parent list; only then does the
     next Esc close the menu. */
  assert.equal(submenuKeyAction('Escape', { hasChildren: true, open: true }), 'close');
  assert.equal(submenuKeyAction('Escape', { hasChildren: true, open: false }), 'dismiss');
});

test('the menu wires those keys to the submenu state', () => {
  const start = source.indexOf('export function ContextMenu(');
  assert.notEqual(start, -1);
  const next = source.indexOf('export { ContextMenu };', start + 10);
  const block = source.slice(start, next === -1 ? undefined : next);
  assert.match(block, /const openSubmenu = \(item: MenuAction\) => \{/);
  assert.match(block, /event\.key === 'ArrowRight'/);
  assert.match(block, /event\.key === 'ArrowLeft' && submenu !== null/);
  assert.match(block, /setSubmenu\(null\)/);
});
