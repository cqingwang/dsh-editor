import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);
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
