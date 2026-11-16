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

test('active Text search options are reported once in IDEA order', () => {
  const activeOptions = new Function(
    `${extractFunction('searchEverywhereActiveOptionIds')}; return searchEverywhereActiveOptionIds;`,
  )();
  assert.deepEqual(activeOptions({}), []);
  assert.deepEqual(activeOptions({ caseSensitive: true }), ['case']);
  assert.deepEqual(activeOptions({ wholeWords: true }), ['words']);
  assert.deepEqual(activeOptions({ regex: true }), ['regex']);
  assert.deepEqual(activeOptions({ fileMask: '*.ts' }), ['fileMask']);
  assert.deepEqual(activeOptions({ fileMask: '  ' }), []);
  assert.deepEqual(activeOptions({
    fileMask: '*.ts',
    regex: true,
    wholeWords: true,
    caseSensitive: true,
  }), ['case', 'words', 'regex', 'fileMask']);
});

test('Clear all options and the used-options summary share one predicate', () => {
  const offersClearOptions = new Function(
    `${extractFunction('searchEverywhereActiveOptionIds')}; ${extractFunction('searchEverywhereOffersClearOptions')}; return searchEverywhereOffersClearOptions;`,
  )();
  const base = {
    tab: 'text',
    query: 'needle',
    resultCount: 0,
    loading: false,
    caseSensitive: false,
    wholeWords: false,
    regex: false,
    fileMask: '',
  };
  assert.equal(offersClearOptions(base), false);
  assert.equal(offersClearOptions({ ...base, fileMask: '*.ts' }), true);
});

test('Text empty state renders the active search option labels', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /const activeSearchOptionIds = searchEverywhereActiveOptionIds\(\{/);
  assert.match(dialog, /const activeSearchOptionsText = activeSearchOptionIds\s*\.map/);
  assert.match(dialog, /data-dsh-search-used-options/);
  assert.match(dialog, /t\('editor\.searchOptionsUsed'\)/);
  assert.match(dialog, /t\('editor\.searchFileMaskLabel'\)/);
  assert.equal((source.match(/searchOptionsUsed:/g) ?? []).length, 2);
  assert.equal((source.match(/searchFileMaskLabel:/g) ?? []).length, 2);
});
