import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const toolbarModel = await readFile(new URL('../src/client/components/ui/toolbar-model.ts', import.meta.url), 'utf8');
const panelToolbar = await readFile(
  new URL('../src/client/components/ui/PanelToolbar.tsx', import.meta.url),
  'utf8',
);

test('a toolbar badge action name includes the visible branch value', () => {
  const label = new Function(
    `${transpileTypeScriptFunction(toolbarModel, 'toolbarBadgeAccessibleLabel')}\nreturn toolbarBadgeAccessibleLabel;`,
  )();
  assert.equal(label('main', 'Checkout branch'), 'Checkout branch: main');
  assert.equal(label('feature/very-long-name ↑1 ↓2', 'Checkout branch'), 'Checkout branch: feature/very-long-name ↑1 ↓2');
  assert.equal(label(null, 'Checkout branch'), 'Checkout branch');
  assert.equal(label('main', ''), 'main');
});

test('PanelToolbar applies the combined label to the badge tooltip and accessible name', () => {
  assert.match(panelToolbar, /const badgeAccessibleLabel = toolbarBadgeAccessibleLabel\(/u);
  assert.match(panelToolbar, /title=\{badgeAccessibleLabel\}/u);
  assert.match(panelToolbar, /aria-label=\{badgeAccessibleLabel\}/u);
});
