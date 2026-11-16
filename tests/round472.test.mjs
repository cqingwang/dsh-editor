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

test('Search Everywhere arrow navigation skips disabled results and wraps', () => {
  const next = extract('nextEnabledSearchResultIndex');
  const rows = [
    { disabled: false },
    { disabled: true },
    { disabled: false },
    { disabled: true },
  ];
  assert.equal(next(rows, 0, 1), 2);
  assert.equal(next(rows, 2, 1), 0);
  assert.equal(next(rows, 0, -1), 2);
  assert.equal(next([{ disabled: true }, { disabled: true }], 0, 1), null);
  assert.equal(next([], 0, 1), null);
});

test('disabled actions expose a reason and cannot be activated', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  const actions = source.slice(source.indexOf('const searchEverywhereActions = React.useMemo'), source.indexOf('/* Recompute match count'));
  assert.match(actions, /disabledReason: !hasEditorModel \? t\('editor\.findEditorRequired'\) : t\('editor\.findStepInactive'\)/);
  assert.match(dialog, /nextEnabledSearchResultIndex\(results, activeIndex, direction\)/);
  assert.match(dialog, /moveSearchSelection\(1\)/);
  assert.match(dialog, /moveSearchSelection\(-1\)/);
  assert.match(source, /function searchEverywhereResultTooltip\(result\)/);
  assert.match(source, /result\.disabledReason \?\?/);
  assert.match(dialog, /if \(result === null \|\| result\.disabled === true\) return/);
});

test('action filters do not bypass recent-command ranking', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  const ranking = dialog.indexOf('rankSearchActions(actions, effectiveQuery, recentCommands, {');
  const filter = dialog.indexOf('searchFilters.actions ? actionMatches.slice(0, 12)');
  assert.ok(ranking > 0 && filter > ranking);
});
