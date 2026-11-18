import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

function extract(name) {
  return new Function(`${extractSource(name)}; return ${name};`)();
}

test('filtered result indexes converge to an enabled visible row', () => {
  const normalize = new Function(
    `${extractSource('nextEnabledSearchResultIndex')}\n${extractSource('normalizeSearchResultIndex')}\nreturn normalizeSearchResultIndex;`,
  )();
  const rows = [
    { disabled: true },
    { disabled: false },
    { disabled: true },
    { disabled: false },
  ];
  assert.equal(normalize(rows, 0), 1);
  assert.equal(normalize(rows, 2), 3);
  assert.equal(normalize(rows, 99), 3);
  assert.equal(normalize([{ disabled: true }], 7), 0);
  assert.equal(normalize([], 7), 0);
});

test('Search Everywhere synchronizes a stale index after filters change', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const activeIndex = normalizeSearchResultIndex\(results, state\.index\)/);
  assert.match(dialog, /state\.index !== activeIndex/);
  assert.match(dialog, /onMove\(0, results\.length, activeIndex\)/);
});

test('normalized slash results keep disabled actions visible but guarded', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /rankSearchActions\(actions, effectiveQuery, recentCommands, \{/);
  assert.match(dialog, /searchFilters\.actions \? actionMatches/);
  assert.match(dialog, /searchFilters\.files \? fileMatches/);
  assert.doesNotMatch(dialog, /actionMatches\.filter\(\(action\) => action\.disabled !== true\)/);
  assert.match(source, /function searchEverywhereResultTooltip\(result\)/);
  assert.match(source, /result\.disabledReason \?\?/);
  assert.match(dialog, /nextEnabledSearchResultIndex\(results, activeIndex, direction\)/);
});
