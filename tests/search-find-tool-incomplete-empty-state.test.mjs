import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const commit = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const panel = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find empty state never claims an absolute no-match when results are incomplete', () => {
  const message = loadTypeScriptFunction(commit, 'findToolEmptyResultMessage');
  const translate = (key) => key;

  assert.equal(message(translate, true, false), 'editor.searchNoMatchesIncomplete');
  assert.equal(message(translate, true, true), 'editor.searchNoMatchesIncomplete');
  assert.equal(message(translate, false, false), 'editor.findToolNoMatches');
  assert.equal(message(translate, false, true), 'editor.findToolNothingFound');
});

test('FindToolWindow routes its empty result copy through the shared helper', () => {
  assert.equal(
    (
      panel.match(
        /findToolEmptyResultMessage\(t, state\.truncated === true, floating\)/gu,
      ) ?? []
    ).length,
    2,
  );
});
