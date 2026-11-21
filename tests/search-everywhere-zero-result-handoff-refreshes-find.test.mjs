import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const searchFindHandoff = new Function(
  `${transpileTypeScriptFunction(commitSource, 'searchEverywhereRequiresResultConfirmation')}; ${transpileTypeScriptFunction(commitSource, 'searchFindHandoff')}; return searchFindHandoff;`,
)();

test('a non-empty zero-result handoff asks Find to run the content search', () => {
  const result = searchFindHandoff({
    query: 'ehthumbs_vista.db',
    files: [],
    matches: [],
  });

  assert.equal(result.total, 0);
  assert.equal(result.request.refresh, true);
});

test('handoffs with existing results and empty queries keep their current lifecycle', () => {
  const withResults = searchFindHandoff({
    query: 'needle',
    files: [{ path: 'src/app.ts' }],
    matches: [],
  });
  const emptyQuery = searchFindHandoff({
    query: '',
    files: [],
    matches: [],
  });

  assert.equal('refresh' in withResults.request, false);
  assert.equal('refresh' in emptyQuery.request, false);
});
