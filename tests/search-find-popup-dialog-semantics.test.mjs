import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find popup exposes modal dialog semantics while the dock remains a region', () => {
  assert.match(component, /role=\{floating \? 'dialog' : 'region'\}/u);
  assert.match(component, /aria-modal=\{floating \? 'true' : undefined\}/u);
  assert.doesNotMatch(component, /\n      role='region'\n/u);
});
