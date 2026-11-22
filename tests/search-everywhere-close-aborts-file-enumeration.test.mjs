import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractUseEffectExpressionContaining, loadTypeScriptExpression } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const requestSource = await readFile(
  new URL('../src/client/components/search/use-search-everywhere-file-candidates.ts', import.meta.url),
  'utf8',
);

test('Search Everywhere close and dismiss abort the file enumeration', () => {
  for (const name of ['closeSearchEverywhere', 'dismissSearchEverywhere']) {
    const start = source.indexOf(`const ${name} = React.useCallback`);
    const end = source.indexOf('\n  }, [', start);
    const block = source.slice(start, end);
    assert.match(block, /abortSearchEverywhereFileRequests\(\);/u);
  }
  assert.match(requestSource, /requestRef\.current \+= 1;/u);
  assert.match(requestSource, /abortRef\.current\?\.abort\(\);/u);
});

test('every closed Search Everywhere state aborts file enumeration without a dedicated close callback', () => {
  let aborts = 0;
  const scope = {
    searchEverywhereOpen: false,
    abortSearchEverywhereFileRequests: () => {
      aborts += 1;
    },
  };
  const expression = extractUseEffectExpressionContaining(source, 'if (searchEverywhereOpen) return;');
  const effect = loadTypeScriptExpression(source, expression, scope);
  effect();
  assert.equal(aborts, 1);
  scope.searchEverywhereOpen = true;
  effect();
  assert.equal(aborts, 1);
});
