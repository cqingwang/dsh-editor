import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('closing Project speed search invalidates the current request generation', async () => {
  const panel = await read('src/client/components/project/ProjectPanel.tsx');
  const searchRequestRef = { current: 4 };
  const clearTreeSearchState = loadTypeScriptCallback(panel, 'clearTreeSearchState', {
    searchRequestRef,
    setSearch: () => {},
    setSearchEntries: () => {},
    setSearchPending: () => {},
    setSearchError: () => {},
    setSearchTruncated: () => {},
  });

  clearTreeSearchState();

  assert.equal(searchRequestRef.current, 5);
});
