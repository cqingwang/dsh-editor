import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const blockedByChildContext = loadTypeScriptFunction(foundationSource, 'findActionShortcutBlockedByChildContext');

function contextElement(markers) {
  const matched = new Set(Array.isArray(markers) ? markers : [markers]);
  return {
    closest(selector) {
      return [...matched].some((marker) => String(selector).includes(marker)) ? {} : null;
    },
  };
}

test('Find Action works while Monaco owns the editor focus', () => {
  const monacoTextarea = contextElement(['textarea', '.monaco-editor']);
  assert.equal(blockedByChildContext(monacoTextarea, monacoTextarea), false);
});

test('Find Action still yields to controls and tool windows that own the chord', () => {
  for (const marker of ['input', '[data-dsh-editor-terminal]', '[data-dsh-changes-panel]', '[role="tree"]']) {
    const owner = contextElement(marker);
    assert.equal(blockedByChildContext(owner, null), true, `${marker} should keep its own key handling`);
  }
});

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
