import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const parametersEnd = source.indexOf(')', start);
  const bodyStart = source.indexOf('{', parametersEnd);
  assert.ok(parametersEnd > start && bodyStart > parametersEnd, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Find Action global chord defers to existing child contexts', () => {
  const blocked = new Function(
    `${extractFunction('findActionShortcutBlockedByChildContext')}; return findActionShortcutBlockedByChildContext;`,
  )();
  const match = { closest: () => ({}) };
  const miss = { closest: () => null };
  assert.equal(blocked(match, miss), true);
  assert.equal(blocked(miss, match), true);
  assert.equal(blocked(miss, miss), false);
  assert.equal(blocked(null, null), false);
  assert.equal(blocked({}, {}), false);
});

test('Editor opens Search Everywhere Actions from the global IDEA chord', () => {
  assert.match(source, /findActionShortcutMatches\(event, macPlatform\)/);
  assert.match(source, /findActionShortcutBlockedByChildContext\(event\.target, document\.activeElement\)/);
  assert.match(source, /openSearchEverywhere\('actions'\)/);
  assert.match(source, /if \(searchEverywhereOpen\) return;/);
  assert.match(source, /data-dsh-search-query/);
});

test('the global handler is host-scoped and consumes the chord', () => {
  const start = source.indexOf('const findActionGlobalShortcut =');
  assert.notEqual(start, -1, 'global Find Action handler is missing');
  const end = source.indexOf("window.addEventListener('keydown', onKeyDown, true)", start);
  const handler = source.slice(start, end);
  assert.match(handler, /data-dsh-editor-workspace/);
  assert.match(handler, /host\.contains\(document\.activeElement\)/);
  assert.match(handler, /event\.preventDefault\(\)/);
  assert.match(handler, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(handler, /onClose|setSearchEverywhere\(null\)/);
});
