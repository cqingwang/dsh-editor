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

test('ToggleFindInSelection chooses toggle, open, or no-op without duplicating scope math', () => {
  const fn = new Function(`${extractFunction('editorFindSelectionShortcutAction')}; return editorFindSelectionShortcutAction;`)();
  assert.equal(fn({ find: 'needle' }, null), 'toggle');
  assert.equal(fn(null, { start: 4, end: 10 }), 'open');
  assert.equal(fn(null, null), null);
});

test('Control+Alt+E reuses the existing find scope toggle and opener', () => {
  const effect = source.slice(
    source.indexOf('/* IDEA Toggle Find in Selection'),
    source.indexOf('const closeSearchEverywhere', source.indexOf('/* IDEA Toggle Find in Selection')),
  );
  assert.match(effect, /event\.ctrlKey !== true/);
  assert.match(effect, /event\.altKey !== true/);
  assert.match(effect, /event\.metaKey === true/);
  assert.match(effect, /event\.shiftKey === true/);
  assert.match(effect, /event\.key\.toLowerCase\(\) !== 'e'/);
  assert.match(effect, /editorFindSelectionShortcutAction\(replaceState, scope\)/);
  assert.match(effect, /toggleFindSelectionScope\(\)/);
  assert.match(effect, /openEditorFindInSelection\(scope, null, null, 'query'\)/);
  assert.match(effect, /data-dsh-search-everywhere/);
  assert.match(effect, /data-dsh-find-tool-window/);
  assert.match(effect, /data-dsh-editor-terminal/);
});
