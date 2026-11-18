import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('search options restore in both Search Everywhere and Find', () => {
  const openSearchEverywhere = source.slice(
    source.indexOf('const openSearchEverywhere = React.useCallback'),
    source.indexOf('const toggleIncludeNonProject'),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const findToolOpen ='),
  );
  assert.match(source, /dsh-editor\.search\.options\.v1/);
  assert.match(openSearchEverywhere, /readSearchOptions\(\)/);
  assert.match(openFind, /readSearchOptions\(\)/);
  assert.match(source, /writeSearchOptions\(searchEverywhere\)/);
  assert.match(source, /writeSearchOptions\(findTool\)/);
});

test('stored search options are normalized defensively', () => {
  const normalizeSearchOptions = new Function(
    `${extractSource('normalizeSearchOptions')}; return normalizeSearchOptions;`,
  )();
  assert.deepEqual(normalizeSearchOptions(null), {
    caseSensitive: false,
    wholeWords: false,
    regex: false,
    preserveCase: false,
    includeExcluded: false,
    fileMask: '',
  });
  assert.deepEqual(normalizeSearchOptions({
    caseSensitive: 'yes',
    wholeWords: 1,
    regex: 'true',
    fileMask: 42,
  }), {
    caseSensitive: false,
    wholeWords: false,
    regex: false,
    preserveCase: false,
    includeExcluded: false,
    fileMask: '',
  });
  assert.deepEqual(normalizeSearchOptions({
    caseSensitive: true,
    wholeWords: true,
    regex: true,
    preserveCase: true,
    fileMask: '*.ts',
  }), {
    caseSensitive: true,
    wholeWords: false,
    regex: true,
    preserveCase: true,
    includeExcluded: false,
    fileMask: '*.ts',
  });
});

test('an oversized stored mask falls back instead of leaking into search', () => {
  const normalizeSearchOptions = new Function(
    `${extractSource('normalizeSearchOptions')}; return normalizeSearchOptions;`,
  )();
  assert.equal(normalizeSearchOptions({ fileMask: 'x'.repeat(513) }).fileMask, '');
});
