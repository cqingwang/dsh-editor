import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8')));

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

test('Search Everywhere to Find handoff preserves non-project scope', () => {
  const handoff = new Function(
    `${extractFunction('searchEverywhereRequiresResultConfirmation')}; ${extractFunction('searchFindHandoff')}; return searchFindHandoff;`,
  )();
  const result = handoff({
    query: 'needle',
    files: [],
    matches: [{ path: 'node_modules/pkg/a.js', line: 1, column: 1 }],
    includeExcluded: true,
  });
  assert.equal(result.request.includeExcluded, true);
  assert.match(source, /includeExcluded: state\.includeNonProject === true/);
});

test('persistent Find exposes the same non-project scope and forwards it while searching', () => {
  const findWindow = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(findWindow, /id: 'include'/);
  assert.match(findWindow, /label: t\('editor\.includeNonProjectItems'\)/);
  assert.match(findWindow, /active: state\.includeExcluded === true/);
  assert.match(findWindow, /onClick: onToggleIncludeExcluded/);
  assert.match(source, /includeExcluded: findTool\?\.includeExcluded === true/);
});

test('Find opens with the handed-off non-project scope and resets results when toggled', () => {
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const openShowUsages = React.useCallback'),
  );
  assert.match(openFind, /includeExcluded: initial !== null/);
  assert.match(openFind, /\? initial\.includeExcluded === true/);
  assert.match(openFind, /: savedOptions\.includeExcluded === true/);
  assert.match(source, /onToggleIncludeExcluded: \(\) => setFindTool/);
  const toggle = source.slice(
    source.indexOf('onToggleIncludeExcluded: () => setFindTool'),
    source.indexOf('onFileMaskChange:', source.indexOf('onToggleIncludeExcluded: () => setFindTool')),
  );
  assert.match(toggle, /includeExcluded: current\.includeExcluded !== true/);
  assert.match(toggle, /files: \[\]/);
  assert.match(toggle, /matches: \[\]/);
  assert.match(toggle, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
});

test('blank Replace in Files carries the current non-project scope', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function ShowUsagesPopup('),
  );
  assert.match(searchEverywhere, /includeExcluded: state\.includeNonProject === true/);
  assert.match(searchEverywhere, /preserveCase: state\.preserveCase === true/);
});
