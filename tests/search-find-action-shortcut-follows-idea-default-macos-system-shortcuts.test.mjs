import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

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

test('Find Action shortcut follows IDEA default and macOS System Shortcuts keymaps', () => {
  const matches = new Function(
    `${extractFunction('findActionShortcutMatches')}; return findActionShortcutMatches;`,
  )();
  const event = (key, modifiers = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: true,
    isComposing: false,
    ...modifiers,
  });
  assert.equal(matches(event('a', { metaKey: true }), true), true);
  assert.equal(matches(event('p', { metaKey: true }), true), true);
  assert.equal(matches(event('A', { ctrlKey: true }), false), true);
  assert.equal(matches(event('a', { ctrlKey: true }), true), false);
  assert.equal(matches(event('a', { metaKey: true }), false), false);
  assert.equal(matches(event('a', { metaKey: true, altKey: true }), true), false);
  assert.equal(matches(event('a', { metaKey: true, shiftKey: false }), true), false);
  assert.equal(matches(event('a', { metaKey: true, isComposing: true }), true), false);
});

test('Find Action advertises its primary macOS shortcut', () => {
  const start = actions.indexOf("id: 'findAction'");
  const end = actions.indexOf("id: '", start + 1);
  const action = actions.slice(start, end < 0 ? actions.length : end);
  assert.match(action, /shortcut: '⇧⌘A'/);
});

test('Search Everywhere owns Find Action chords without closing the dialog', () => {
  const component = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(component, /findActionShortcutMatches\(event, macPlatform\)/);
  assert.match(component, /onQuery\(''\)/);
  assert.match(component, /onTab\('actions'\)/);
  assert.match(component, /data-dsh-search-query/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(component, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(component.slice(
    component.indexOf('const findActionShortcut ='),
    component.indexOf("window.addEventListener('keydown', onKeyDown, true)", component.indexOf('const findActionShortcut =')),
  ), /onClose\(\)/);
});
