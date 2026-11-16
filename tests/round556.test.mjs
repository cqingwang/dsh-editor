import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const normalize = new Function(`${extractSource('searchEverywhereAriaKeyShortcuts')}\nreturn searchEverywhereAriaKeyShortcuts;`)();

test('IDEA shortcut glyphs normalize to ARIA keyshortcuts syntax', () => {
  assert.equal(normalize('⌘⇧O'), 'Meta+Shift+O');
  assert.equal(normalize('⌘F'), 'Meta+F');
  assert.equal(normalize('⌥F7'), 'Alt+F7');
  assert.equal(normalize('⌃G'), 'Control+G');
  assert.equal(normalize('⌃⇧G'), 'Control+Shift+G');
  assert.equal(normalize('⌃⌘G'), 'Control+Meta+G');
  assert.equal(normalize('F3'), 'F3');
  assert.equal(normalize(''), undefined);
  assert.equal(normalize(null), undefined);
});

test('Search Everywhere action rows expose normalized shortcut metadata', () => {
  assert.match(source, /ariaKeyShortcuts: searchEverywhereAriaKeyShortcuts\(action\.shortcut\)/);
  assert.match(source, /'aria-keyshortcuts': result\.ariaKeyShortcuts/);
});

test('visible shortcut text remains unchanged alongside the ARIA metadata', () => {
  assert.match(source, /result\.shortcut \? React\.createElement\('span', \{ style: styles\.searchEverywhereShortcut \}, result\.shortcut\) : null/);
  assert.match(source, /searchEverywhereResultTooltip\(result\)/);
});
