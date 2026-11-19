import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find listbox exposes loading as aria-busy without hiding retained results', () => {
  assert.match(component, /aria-busy=\{state\.loading === true \? true : undefined\}/u);
  assert.match(
    component,
    /role='listbox'[\s\S]*?aria-busy=\{state\.loading === true \? true : undefined\}[\s\S]*?aria-activedescendant=/u,
  );
  assert.doesNotMatch(component, /state\.loading === true \? \[\] :/u);
});
