import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

test('search handoff maps the active file or text row into the Find list', () => {
  const handoff = handoffFactory();
  const files = [{ path: 'src/app.js', rowKey: 'file:src/app.js' }];
  const matches = [
    { path: 'README.md', line: 3, column: 1, rowKey: 'text:README.md:3:1' },
    { path: 'docs/notes.md', line: 2, column: 1, rowKey: 'text:docs/notes.md:2:1' },
  ];
  assert.equal(handoff({ files, matches, activeRowKey: 'file:src/app.js' }).request.index, 0);
  assert.equal(handoff({ files, matches, activeRowKey: 'text:docs/notes.md:2:1' }).request.index, 2);
  assert.equal(handoff({ files, matches, activeRowKey: 'missing' }).request.index, 0);
});

test('Search Everywhere passes active or clicked result into the shared handoff', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindow('));
  assert.match(dialog, /const openSearchResultsInFind = \(mode = null, result = null, \{ refresh = false \} = \{\}\) =>/);
  assert.match(dialog, /activeRowKey: \(result \?\? activeResult\)\?\.rowKey/);
  assert.match(dialog, /onClick: \(\) => openSearchResultsInFind\(null, activeResult\)/);
  assert.match(dialog, /onReplace: \(\) => openSearchResultsInFind\('replace', result\)/);
});

test('openFindTool stores and clamps the initial active index', () => {
  const opener = source.slice(source.indexOf('const openFindTool = React.useCallback'), source.indexOf('React.useEffect(() => {\n        if (searchEverywhere !== null) writeSearchOptions'));
  assert.match(opener, /const initialCount = \(Array\.isArray\(initial\?\.files\) \? initial\.files\.length : 0\) \+ \(Array\.isArray\(initial\?\.matches\) \? initial\.matches\.length : 0\)/);
  assert.match(opener, /index: Math\.max\(0, Math\.min\(initialCount - 1, Number\(initial\?\.index\) \|\| 0\)\)/);
});

test('Find handoff request keeps options while adding active index', () => {
  const handoff = extractSource('searchFindHandoff');
  assert.match(handoff, /activeRowKey/);
  assert.match(handoff, /index:/);
  assert.match(handoff, /caseSensitive:/);
  assert.match(handoff, /wholeWords:/);
  assert.match(handoff, /fileMask:/);
});
