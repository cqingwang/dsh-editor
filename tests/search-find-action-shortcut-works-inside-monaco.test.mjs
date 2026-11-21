import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');

const findActionShortcutMatches = loadTypeScriptFunction(foundationSource, 'findActionShortcutMatches');
const findActionShortcutLabel = loadTypeScriptFunction(foundationSource, 'findActionShortcutLabel');

test('the macOS Find Action chord matches both IDEA defaults', () => {
  assert.equal(findActionShortcutMatches({ key: 'a', metaKey: true, shiftKey: true }, true), true);
  assert.equal(findActionShortcutMatches({ key: 'p', metaKey: true, shiftKey: true }, true), true);
  assert.equal(findActionShortcutMatches({ key: 'a', ctrlKey: true, shiftKey: true }, true), false);
});

test('the action surface advertises the host-safe IDEA chord', () => {
  assert.equal(findActionShortcutLabel(true), '⇧⌘P');
  assert.equal(findActionShortcutLabel(false), '⌃⇧A');
});
