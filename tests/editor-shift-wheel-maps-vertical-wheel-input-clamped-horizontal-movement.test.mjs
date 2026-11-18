import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

const shiftWheelScrollLeft = new Function(
  `${extract('shiftWheelScrollLeft')}\nreturn shiftWheelScrollLeft;`,
)();

test('Shift+Wheel maps vertical wheel input to clamped horizontal movement', () => {
  assert.equal(shiftWheelScrollLeft({ shiftKey: false, deltaY: 120, scrollLeft: 0, scrollWidth: 600, clientWidth: 200 }), null);
  assert.equal(shiftWheelScrollLeft({ shiftKey: true, deltaY: 120, scrollLeft: 0, scrollWidth: 600, clientWidth: 200 }), 120);
  assert.equal(shiftWheelScrollLeft({ shiftKey: true, deltaY: 500, scrollLeft: 360, scrollWidth: 600, clientWidth: 200 }), 400);
  assert.equal(shiftWheelScrollLeft({ shiftKey: true, deltaY: -120, scrollLeft: 40, scrollWidth: 600, clientWidth: 200 }), 0);
  assert.equal(shiftWheelScrollLeft({ shiftKey: true, deltaY: 120, scrollLeft: 400, scrollWidth: 600, clientWidth: 200 }), null);
});

test('all horizontal tool surfaces use the shared Shift+Wheel bridge', () => {
  assert.match(source, /function applyShiftWheelScroll\(event\) \{/);
  assert.match(source, /function bindShiftWheelScroll\(node\) \{/);
  assert.match(source, /addEventListener\('wheel', applyShiftWheelScroll, \{ passive: false \}\)/);
  assert.match(source, /node\.scrollLeft = next;/);
  const count = (source.match(/bindShiftWheelScroll\(/g) ?? []).length;
  assert.ok(count >= 5, `expected Project, Changes, Log, detail and binder; found ${count}`);
});
