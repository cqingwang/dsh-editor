import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('search options persist Include non-project as a normalized boolean', () => {
  const normalize = new Function(`${extractFunction('normalizeSearchOptions')}; return normalizeSearchOptions;`)();
  assert.equal(normalize(null).includeExcluded, false);
  assert.equal(normalize({ includeExcluded: 'yes' }).includeExcluded, false);
  assert.equal(normalize({ includeExcluded: true }).includeExcluded, true);
  assert.equal(normalize({ includeNonProject: true }).includeExcluded, true);
  assert.equal(normalize({ includeExcluded: true, includeNonProject: false }).includeExcluded, false);
});

test('Search Everywhere restores its scope from persisted options', () => {
  const open = source.slice(
    source.indexOf('const openSearchEverywhere = React.useCallback'),
    source.indexOf('const toggleIncludeNonProject'),
  );
  assert.match(open, /const savedOptions = readSearchOptions\(\)/);
  assert.match(open, /const includeNonProject = savedOptions\.includeExcluded === true/);
  assert.match(open, /includeNonProject,/);
  assert.match(open, /const cachedFilesMatchScope = searchEverywhereFilesScopeRef\.current === includeNonProject/);
  assert.match(source, /requestSearchEverywhereFiles\(includeNonProject\)/);
  assert.match(source, /op: 'files', includeExcluded: includeNonProject === true/);
  assert.match(source, /writeSearchOptions\(searchEverywhere\)/);
  assert.match(source, /searchEverywhere\?\.includeNonProject/);
});

test('Find blank-open restores scope while explicit handoff scope wins', () => {
  const open = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const openShowUsages = React.useCallback'),
  );
  assert.match(open, /normalizeSearchOptions\(initial === null \? readSearchOptions\(\) : initial\)/);
  assert.match(open, /includeExcluded: initial !== null[\s\S]*?: savedOptions\.includeExcluded === true/);
  assert.match(source, /writeSearchOptions\(findTool\)/);
  assert.match(source, /findTool\?\.includeExcluded/);
});

test('Search Everywhere Find requests always carry an explicit scope', () => {
  const handoff = new Function(
    `${extractFunction('searchEverywhereRequiresResultConfirmation')}; ${extractFunction('searchFindHandoff')}; return searchFindHandoff;`,
  )();
  const normal = handoff({ query: 'needle', files: [], matches: [] });
  assert.equal(normal.request.includeExcluded, false);
  const included = handoff({ query: 'needle', files: [], matches: [], includeExcluded: true });
  assert.equal(included.request.includeExcluded, true);
});
