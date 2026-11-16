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
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('large Search Everywhere result sets require explicit confirmation', () => {
  const requires = extract('searchEverywhereRequiresResultConfirmation');
  assert.equal(requires([], [], 200), false);
  assert.equal(requires(Array(200).fill('a'), [], 200), false);
  assert.equal(requires(Array(201).fill('a'), [], 200), true);
  assert.equal(requires(Array(80).fill('a'), Array(121).fill({}), 200), true);
});

test('Open in Find Tool Window confirms oversized result sets', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /const request = searchFindHandoff\(\{/);
  assert.match(dialog, /request\.needsConfirmation && !window\.confirm\(t\('editor\.searchTooManyResults'/);
  assert.match(dialog, /count: request\.total/);
});

test('Search Everywhere exposes IDEA find-next and find-previous actions', () => {
  const actions = source.slice(source.indexOf('const searchEverywhereActions = React.useMemo'), source.indexOf('/* Recompute match count'));
  assert.match(actions, /id: 'findNext'/);
  assert.match(actions, /id: 'findPrevious'/);
  assert.match(actions, /shortcut: '⌘G'/);
  assert.match(actions, /shortcut: '⇧⌘G'/);
  assert.match(actions, /editorFindStepRef\.current\?\.\(1\)/);
  assert.match(actions, /editorFindStepRef\.current\?\.\(-1\)/);
  assert.match(source, /editorFindStepRef\.current = jumpToMatch/);
});
