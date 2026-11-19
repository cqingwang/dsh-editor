import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/client/components/search/QuickOpen.tsx', import.meta.url), 'utf8');

test('Quick Open connects its combobox to a busy-aware option listbox', () => {
  assert.match(component, /const QUICK_OPEN_LISTBOX_ID = 'dsh-editor-quick-open-listbox';/u);
  assert.match(component, /role='combobox'/u);
  assert.match(component, /aria-autocomplete='list'/u);
  assert.match(component, /aria-controls=\{QUICK_OPEN_LISTBOX_ID\}/u);
  assert.match(
    component,
    /aria-activedescendant=\{matches\[index\] === undefined \? undefined : quickOpenOptionId\(matches\[index\]\.path\)\}/u,
  );
  assert.match(component, /id=\{QUICK_OPEN_LISTBOX_ID\}/u);
  assert.match(component, /role='listbox'/u);
  assert.match(component, /aria-busy=\{loading \? true : undefined\}/u);
  assert.match(component, /role='option'/u);
  assert.match(component, /aria-selected=\{position === index\}/u);
});
