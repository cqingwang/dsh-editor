import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('provider command helpers and aliases are fully removed', () => {
  assert.doesNotMatch(source, /function searchEverywhereProviderCommand\(/);
  assert.doesNotMatch(source, /function searchEverywhereProviderCompletion\(/);
  assert.doesNotMatch(source, /function searchEverywhereProviderCommandSuggestions\(/);
});

test('slash help and provider command rows are removed from the dialog', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /const effectiveTab = state\.tab;/);
  assert.match(dialog, /const effectiveQuery = query;/);
  assert.doesNotMatch(dialog, /providerCommandResults/);
  assert.doesNotMatch(dialog, /showProviderCommands/);
});

test('ordinary results still record command history without provider rows', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.doesNotMatch(dialog, /provider:\$\{tab\}/);
  assert.match(dialog, /result\.rememberCommand !== false\) onRememberCommand\(result\.id\)/);
});

test('provider command hint copy is no longer shipped', () => {
  for (const key of [
    'providerCommandAllHint',
    'providerCommandFilesHint',
    'providerCommandTextHint',
    'providerCommandActionsHint',
  ]) {
    assert.doesNotMatch(source, new RegExp(`${key}: '`));
  }
});
