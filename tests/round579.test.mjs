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

test('partial slash provider suggestions are removed', () => {
  assert.doesNotMatch(source, /function searchEverywhereProviderCommandSuggestions\(/);
});

test('provider suggestions are not rendered as an input-level result list', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.doesNotMatch(dialog, /providerCommandSuggestions/);
  assert.doesNotMatch(dialog, /providerCommandResults/);
  assert.doesNotMatch(dialog, /showProviderCommands/);
  assert.match(dialog, /const effectiveTab = state\.tab;/);
});

test('Show Usages has a distinct transient popup instead of aliasing Find Usages', () => {
  const actionsStart = source.indexOf('const searchEverywhereActions = React.useMemo');
  const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
  const actions = source.slice(actionsStart, actionsEnd);
  assert.match(actions, /id: 'showUsages'/);
  assert.match(actions, /shortcut: ideaUsageFamilyShortcut\('showUsages', searchMacPlatform\)/);
  assert.match(actions, /openShowUsages\(findUsagesTarget\.query\)/);
  assert.match(source, /function ShowUsagesPopup\(/);
  assert.match(source, /const pinShowUsages = React\.useCallback/);
  assert.match(source, /transient Show Usages popup/i);
});
