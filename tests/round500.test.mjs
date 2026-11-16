import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('(', start);
  let parenDepth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '(') parenDepth += 1;
    else if (source[index] === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) break;
    }
  }
  index = source.indexOf('{', index);
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

function handoffFactory() {
  return new Function(
    `${extractSource('searchEverywhereRequiresResultConfirmation')}\n${extractSource('searchFindHandoff')}\nreturn searchFindHandoff;`,
  )();
}

const files = [{ path: 'src/app.js' }];
const matches = [
  { path: 'README.md', line: 3, column: 1, mtime: 1 },
  { path: 'README.md', line: 4, column: 8, mtime: 1 },
];

test('search handoff preserves find/replace mode and options', () => {
  const handoff = handoffFactory();
  const find = handoff({
    query: 'needle',
    files,
    matches,
    truncated: true,
    mode: 'find',
    caseSensitive: true,
    wholeWords: true,
    regex: false,
    preserveCase: true,
    includeExcluded: false,
    fileMask: '*.md',
  });
  assert.equal(find.needsConfirmation, false);
  assert.equal(find.total, 3);
  assert.deepEqual(find.request, {
    query: 'needle',
    files,
    matches,
    index: 0,
    truncated: true,
    mode: 'find',
    caseSensitive: true,
    wholeWords: true,
    regex: false,
    preserveCase: true,
    includeExcluded: false,
    fileMask: '*.md',
  });

  const replace = handoff({
    query: 'needle',
    files,
    matches,
    mode: 'replace',
    withReplace: false,
  });
  assert.equal(replace.request.mode, 'replace');
});

test('search handoff normalizes whole-words under regex and withReplace', () => {
  const handoff = handoffFactory();
  const result = handoff({
    query: 'needle',
    files: [],
    matches,
    mode: 'find',
    withReplace: true,
    wholeWords: true,
    regex: true,
    fileMask: 'docs/**',
  });
  assert.equal(result.request.mode, 'replace');
  assert.equal(result.request.wholeWords, false);
  assert.equal(result.request.regex, true);
  assert.equal(result.request.fileMask, 'docs/**');
});

test('search handoff applies the existing bounded-result confirmation threshold', () => {
  const handoff = handoffFactory();
  const result = handoff({
    query: 'needle',
    files: [],
    matches: Array.from({ length: 201 }, (_, index) => ({ path: 'a.md', line: index + 1, column: 1 })),
    mode: 'find',
  });
  assert.equal(result.total, 201);
  assert.equal(result.needsConfirmation, true);
});

test('Search Everywhere uses the pure handoff model and exposes Replace once per text row', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /const request = searchFindHandoff\(\{/);
  assert.match(dialog, /if \(request\.needsConfirmation && !window\.confirm/);
  assert.match(dialog, /onOpenInFindToolWindow\(refresh === true \? \{ \.\.\.request\.request, refresh: true \} : request\.request\)/);
  const helper = source.slice(source.indexOf('function searchResultContextItems('), source.indexOf('function searchEverywhereOptionId('));
  assert.equal((helper.match(/id: 'replace'/g) ?? []).length, 1);
  assert.match(helper, /result\.kind === 'text'/);
});
