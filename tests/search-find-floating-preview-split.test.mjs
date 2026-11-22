import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');

test('floating Find preview uses the shared draggable horizontal divider', () => {
  assert.match(component, /\{!previewOpen \? null : \(/u);
  assert.match(component, /<EditorSplitDivider[\s\S]*?orientation=\{floating \? 'horizontal' : 'vertical'\}/u);
  assert.match(component, /percent=\{100 - dockPreviewPercent\}/u);
  assert.match(component, /onChange=\{\(next\) => setDockPreviewPercent\(100 - next\)\}/u);
  assert.match(component, /floating \? clampFindFloatingPreviewPercent\(value, extent\)/u);
  assert.match(
    component,
    /\.\.\.styles\.findToolResultsStack,\s+flex: previewOpen \? `\$\{100 - dockPreviewPercent\} 1 0` : '1 1 auto',/u,
  );
  assert.match(
    component,
    /floating\s+\?\s+\{\s+\.\.\.styles\.findToolPreviewPane,\s+flex: `\$\{dockPreviewPercent\} 1 0`,\s+borderTop: 'none',\s+\}/u,
  );
});

test('floating Find split keeps both panes draggable instead of collapsing to one ratio', () => {
  const { clampFindFloatingPreviewPercent: clamp } = loadTypeScriptModule(findTool, [
    'clampFindFloatingPreviewPercent',
  ]);
  assert.equal(Math.round(clamp(5, 284)), 21);
  assert.equal(Math.round(clamp(95, 284)), 79);
  assert.equal(clamp(Number.NaN), 50);
});
