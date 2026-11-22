import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8');

test('outside-focus Escape keeps nested surfaces and IME ownership', () => {
  const target = new Function(
    `${transpileTypeScriptFunction(source, 'searchEverywhereEscapeTarget')};
    ${transpileTypeScriptFunction(
      source,
      'searchEverywhereOutsideEscapeTarget',
    )}; return searchEverywhereOutsideEscapeTarget;`,
  )();
  const base = {
    targetInsideDialog: false,
    activeInsideDialog: false,
    resultInfoOpen: false,
    defaultPrevented: false,
    isComposing: false,
    nestedSurfaceOpen: false,
  };

  assert.equal(target(base), 'dismiss');
  assert.equal(target({ ...base, resultInfoOpen: true }), 'close-result-info');
  assert.equal(target({ ...base, targetInsideDialog: true }), null);
  assert.equal(target({ ...base, activeInsideDialog: true }), null);
  assert.equal(target({ ...base, defaultPrevented: true }), null);
  assert.equal(target({ ...base, isComposing: true }), null);
  assert.equal(target({ ...base, nestedSurfaceOpen: true }), null);
});

test('Search Everywhere owns a window Escape fallback after focus escapes its DOM', () => {
  assert.match(source, /const searchEverywhereRootRef = React\.useRef<HTMLDivElement \| null>\(null\)/u);
  assert.match(source, /ref=\{searchEverywhereRootRef\}/u);
  assert.match(source, /searchEverywhereOutsideEscapeTarget\(\{/u);
  assert.match(source, /window\.addEventListener\('keydown', onKeyDown, true\)/u);
  assert.match(source, /window\.removeEventListener\('keydown', onKeyDown, true\)/u);
  assert.match(source, /const nestedSurfaceOpen =\s+document\.querySelector<HTMLElement>/u);
  assert.match(source, /eventTargetOutsideDialog/u);
  assert.match(source, /eventActiveOutsideDialog/u);
});
