import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
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

function event(key, modifiers = {}) {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...modifiers,
  };
}

test('usage family displays IDEA macOS primary chords on macOS', () => {
  const shortcut = new Function(
    `${extractFunction('ideaUsageFamilyShortcut')}; return ideaUsageFamilyShortcut;`,
  )();
  assert.equal(shortcut('findUsages', true), '⌃U');
  assert.equal(shortcut('showUsages', true), '⌃⌥U');
  assert.equal(shortcut('findUsagesSettings', true), '⌃⇧⌥U');
  assert.equal(shortcut('findUsages', false), '⌥F7');
  assert.equal(shortcut('showUsages', false), '⌃⌥F7');
  assert.equal(shortcut('findUsagesSettings', false), '⌃⇧⌥F7');
});

test('usage family keymap matches IDEA macOS and default shortcuts', () => {
  const match = new Function(
    `${extractFunction('ideaUsageFamilyShortcutAction')}; return ideaUsageFamilyShortcutAction;`,
  )();
  assert.equal(match(event('u', { ctrlKey: true }), true), 'findUsages');
  assert.equal(match(event('U', { ctrlKey: true, altKey: true }), true), 'showUsages');
  assert.equal(match(event('u', { ctrlKey: true, altKey: true, shiftKey: true }), true), 'findUsagesSettings');
  assert.equal(match(event('F7', { altKey: true }), true), 'findUsages');
  assert.equal(match(event('F7', { metaKey: true, altKey: true }), true), 'showUsages');
  assert.equal(match(event('F7', { metaKey: true, altKey: true, shiftKey: true }), true), 'findUsagesSettings');
  assert.equal(match(event('F7', { altKey: true }), false), 'findUsages');
  assert.equal(match(event('F7', { ctrlKey: true, altKey: true }), false), 'showUsages');
  assert.equal(match(event('F7', { ctrlKey: true, altKey: true, shiftKey: true }), false), 'findUsagesSettings');
  assert.equal(match(event('u', { metaKey: true }), true), null);
  assert.equal(match(event('u', { ctrlKey: true, isComposing: true }), true), null);
  assert.equal(match(event('F7', { ctrlKey: true, altKey: true }), true), null);
});

test('Search Everywhere Action rows use the platform-aware primary shortcut', () => {
  assert.match(actions, /id: 'findUsages'[\s\S]*?shortcut: ideaUsageFamilyShortcut\('findUsages', searchMacPlatform\)/);
  assert.match(actions, /id: 'showUsages'[\s\S]*?shortcut: ideaUsageFamilyShortcut\('showUsages', searchMacPlatform\)/);
  assert.match(
    actions,
    /id: 'findUsagesSettings'[\s\S]*?shortcut: ideaUsageFamilyShortcut\('findUsagesSettings', searchMacPlatform\)/,
  );
  assert.match(source, /const searchMacPlatform = isMacPlatform\(searchPlatform\)/);
});

test('usage family shortcuts normalize to ARIA keyshortcuts', () => {
  const normalize = new Function(
    `${extractFunction('searchEverywhereAriaKeyShortcuts')}; return searchEverywhereAriaKeyShortcuts;`,
  )();
  assert.equal(normalize('⌃U'), 'Control+U');
  assert.equal(normalize('⌃⌥U'), 'Control+Alt+U');
  assert.equal(normalize('⌃⇧⌥U'), 'Control+Shift+Alt+U');
});

test('the same keyboard helper drives real editor actions without stealing inputs', () => {
  const start = source.indexOf('const usageFamilyAction = ideaUsageFamilyShortcutAction');
  assert.notEqual(start, -1, 'usage family keyboard dispatch is missing');
  const end = source.indexOf('const key = event.key.toLowerCase()', start);
  const listener = source.slice(start, end);
  assert.match(listener, /event\.target instanceof Element/);
  assert.match(listener, /closest\('\.monaco-editor'\)/);
  assert.match(listener, /closest\('\[data-dsh-editor-file-surface\]'\)/);
  assert.match(listener, /findUsagesSearchTarget\(currentCodeEditor\(\)\)/);
  assert.match(listener, /usageFamilyAction === 'findUsages'[\s\S]*?openFindUsages/);
  assert.match(listener, /usageFamilyAction === 'showUsages'[\s\S]*?openShowUsages/);
  assert.match(listener, /findUsagesSettings[\s\S]*?return/);
  assert.match(listener, /event\.preventDefault\(\)/);
  assert.match(listener, /event\.stopPropagation\(\)/);
});
