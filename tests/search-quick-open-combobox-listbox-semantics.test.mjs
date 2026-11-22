import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const component = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');

test('Quick Open connects its combobox to a busy-aware option listbox', () => {
  assert.match(component, /const QUICK_OPEN_LISTBOX_ID = 'dsh-editor-quick-open-listbox';/u);
  assert.match(component, /role='combobox'/u);
  assert.match(component, /aria-autocomplete='list'/u);
  assert.match(component, /aria-controls=\{QUICK_OPEN_LISTBOX_ID\}/u);
  assert.match(
    component,
    /aria-activedescendant=\{\s*matches\[activeIndex\] === undefined \? undefined : quickOpenOptionId\(matches\[activeIndex\]\.path\),?\s*\}/u,
  );
  assert.match(component, /id=\{QUICK_OPEN_LISTBOX_ID\}/u);
  assert.match(component, /role='listbox'/u);
  assert.match(component, /aria-busy=\{loading \? true : undefined\}/u);
  assert.match(component, /role='option'/u);
  assert.match(component, /aria-selected=\{position === activeIndex\}/u);
});

test('Quick Open preserves the selected path when async candidates merge', () => {
  const activeIndex = loadTypeScriptFunction(
    component.slice(
      component.indexOf('export function quickOpenActiveIndex('),
      component.indexOf('\n}\n', component.indexOf('export function quickOpenActiveIndex(')) + 2,
    ),
    'quickOpenActiveIndex',
  );
  const matches = [{ path: 'new.ts' }, { path: 'kept.ts' }, { path: 'last.ts' }];
  assert.equal(activeIndex(matches, 0, 'kept.ts'), 1);
  assert.equal(activeIndex(matches, 9, 'missing.ts'), 2);
  assert.equal(activeIndex([], 5, null), 0);
});
