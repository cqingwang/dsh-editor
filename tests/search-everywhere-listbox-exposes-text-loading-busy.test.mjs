import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url),
  'utf8',
);

test('Search Everywhere listbox exposes only active text loading as busy', () => {
  assert.match(component, /aria-busy=\{textLoading && effectiveTab !== 'actions' \? true : undefined\}/u);
  assert.match(
    component,
    /role='listbox'[\s\S]*?aria-busy=\{textLoading && effectiveTab !== 'actions' \? true : undefined\}[\s\S]*?aria-activedescendant=/u,
  );
});
