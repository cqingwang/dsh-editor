import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const menu = source;

test('hover moves focus to the hovered parent only when a child menu owns focus', () => {
  assert.match(
    menu,
    /onMouseEnter=\{\(event\) => \{[\s\S]*?const childHadFocus =\s+document\.activeElement instanceof Element &&\s+document\.activeElement\.closest\('\[role="menu"\]'\) !== ref\.current;[\s\S]*?if \(childHadFocus\) event\.currentTarget\.focus\(\);/s,
  );
});

test('hover still updates the submenu geometry and target after focus recovery', () => {
  assert.match(menu, /if \(childHadFocus\) event\.currentTarget\.focus\(\);\s+setItemRect\(event\.currentTarget\.getBoundingClientRect\(\)\);\s+setSubmenu\(/s);
});

test('ordinary mouse hover does not always steal keyboard focus', () => {
  assert.doesNotMatch(menu, /onMouseEnter=\{\(event\) => \{\s+event\.currentTarget\.focus\(\);/);
});
