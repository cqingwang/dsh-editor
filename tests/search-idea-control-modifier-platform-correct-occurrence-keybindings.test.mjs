import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const groupStart = source.indexOf('function createCodeEditorGroup(');
const groupEnd = source.indexOf('\n    /**\n     * Reuse one workspace model', groupStart);
const group = source.slice(groupStart, groupEnd);

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

function actionBlock(id) {
  const marker = group.indexOf(id);
  assert.notEqual(marker, -1, `${id} is missing`);
  const start = group.lastIndexOf('editor.addAction({', marker);
  assert.notEqual(start, -1, `${id} has no action block`);
  let depth = 0;
  for (let index = group.indexOf('{', start); index < group.length; index += 1) {
    if (group[index] === '{') depth += 1;
    if (group[index] === '}') depth -= 1;
    if (depth === 0) return group.slice(start, index + 2);
  }
  assert.fail(`${id} has no closing action block`);
}

test('IDEA Control modifier is platform-correct for occurrence keybindings', () => {
  const modifier = new Function(
    `${extractFunction('isMacPlatform')}; `
      + `${extractFunction('ideaControlKeyModifier')}; return ideaControlKeyModifier;`,
  )();
  const monaco = { KeyMod: { WinCtrl: 4, CtrlCmd: 8 } };
  assert.equal(modifier(monaco, 'macOS'), 4);
  assert.equal(modifier(monaco, 'MacIntel'), 4);
  assert.equal(modifier(monaco, 'Linux x86_64'), 8);
  assert.equal(modifier(monaco, 'Win32'), 8);
});

test('search-family actions are executable from the source editor keymap', () => {
  assert.match(
    actionBlock('dsh-editor.textSearch'),
    /keybindings: \[ideaControlModifier \| monaco\.KeyMod\.Shift \| monaco\.KeyMod\.Alt \| monaco\.KeyCode\.KeyE\]/,
  );
  assert.match(
    actionBlock('dsh-editor.findUsagesInFile'),
    /keybindings: findUsagesInFileKeybindings/,
  );
  assert.match(
    actionBlock('dsh-editor.highlightUsagesInFile'),
    /keybindings: highlightUsagesInFileKeybindings/,
  );
  assert.match(
    actionBlock('dsh-editor.findWordAtCaret'),
    /keybindings: \[ideaControlModifier \| monaco\.KeyCode\.F3\]/,
  );
  assert.match(
    actionBlock('dsh-editor.previousWordOccurrence'),
    /keybindings: \[ideaControlModifier \| monaco\.KeyMod\.Shift \| monaco\.KeyCode\.F3\]/,
  );
});

test('Text search reuses the existing Search Everywhere Text provider', () => {
  assert.equal((source.match(/textSearchLabel: t\('editor\.textSearchAction'\)/g) ?? []).length, 2);
  assert.equal((source.match(/onSearchText: \(\) => \{\n\s+openSearchEverywhereRef\.current\?\.\('text'\);/g) ?? []).length, 2);
  assert.match(source, /openSearchEverywhereRef\.current = openSearchEverywhere;/);
  assert.match(source, /onSearchText: \(\) => \{[\s\S]*?data-dsh-search-query[\s\S]*?focus/);
  assert.doesNotMatch(group, /searchEverywhereActions/);
});

test('search keybindings stay scoped to Monaco source editors', () => {
  assert.match(group, /const ideaControlModifier = ideaControlKeyModifier\(/);
  assert.doesNotMatch(source, /event\.metaKey === true[\s\S]{0,80}event\.key === 'F7'[\s\S]{0,80}highlightUsagesInFile/);
  assert.doesNotMatch(source, /event\.ctrlKey === true[\s\S]{0,80}event\.key === 'F3'[\s\S]{0,80}findNextWordOccurrence/);
});
