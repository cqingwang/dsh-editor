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

/** Both helpers live in one scope: `submenuSide` delegates to `submenuGeometry`. */
function loadSubmenuHelpers() {
  const at = (name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing`);
    let index = source.indexOf('{', start);
    let depth = 0;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }
    throw new Error(`unbalanced braces in ${name}`);
  };
  return new Function(`${at('submenuGeometry')}\n${at('submenuSide')}; return { submenuGeometry, submenuSide };`)();
}

const { submenuSide, submenuGeometry } = loadSubmenuHelpers();

test('a submenu flips to the left when the menu sits near the right edge', () => {
  /* The child is anchored at `left: 100%` of the parent; in the narrow editor
     column of a 1280px window that lands off-screen. */
  assert.equal(submenuSide({ parentRight: 400, viewportWidth: 1280, submenuWidth: 260 }), 'right');
  assert.equal(submenuSide({ parentRight: 1100, viewportWidth: 1280, submenuWidth: 260 }), 'left');
  /* Exactly at the edge (right + width + 8 == viewport) still fits on the right. */
  assert.equal(submenuSide({ parentRight: 1012, viewportWidth: 1280, submenuWidth: 260 }), 'right');
  /* One pixel further flips. */
  assert.equal(submenuSide({ parentRight: 1013, viewportWidth: 1280, submenuWidth: 260 }), 'left');
});

test('an unmeasured viewport defaults to opening right, IDEA\'s default', () => {
  assert.equal(submenuSide({ parentRight: 0, viewportWidth: 0, submenuWidth: 0 }), 'right');
  assert.equal(submenuSide(null), 'right');
});

test('the submenu position is driven by that decision', () => {
  const start = source.indexOf('export function ContextMenu(');
  assert.notEqual(start, -1);
  const next = source.indexOf('export { ContextMenu };', start + 10);
  const block = source.slice(start, next === -1 ? undefined : next);
  assert.match(block, /submenuGeometry\(/);
  assert.match(block, /styles\.submenuLeft/);
});

test('the submenu width is capped so it cannot overflow a narrow window', () => {
  const start = source.indexOf('      submenu: {');
  const block = source.slice(start, source.indexOf('      menuLabel: {', start));
  assert.match(block, /minWidth: 180/);
  assert.match(block, /maxWidth: 'min\(260px, 60vw\)'/);
});

test('the submenu is capped to the room on the side it opens', () => {
  /* A parent near the right edge of a narrow window has almost no room right:
     the child flips left and shrinks to what is there. */
  const placement = submenuGeometry({ parentLeft: 300, parentRight: 500, viewportWidth: 560, preferredWidth: 260 });
  assert.equal(placement.side, 'left');
  assert.ok(placement.maxWidth <= 292, `maxWidth ${placement.maxWidth} must fit 292px`);
  /* Centred parent: the right side has more room, so it stays right and shrinks. */
  const centred = submenuGeometry({ parentLeft: 145, parentRight: 335, viewportWidth: 560, preferredWidth: 260 });
  assert.equal(centred.side, 'right');
  assert.ok(centred.maxWidth <= 217, `maxWidth ${centred.maxWidth} must fit 217px`);
  /* Plenty of room on the right keeps the preferred width. */
  assert.deepEqual(submenuGeometry({ parentLeft: 100, parentRight: 300, viewportWidth: 1280, preferredWidth: 260 }), { side: 'right', maxWidth: 260 });
});
