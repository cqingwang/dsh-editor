import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const toolbarButton = await readFile(new URL('../src/client/components/ui/ToolbarButton.tsx', import.meta.url), 'utf8');

test('popup toolbar buttons open from ContextMenu and Shift+F10', () => {
  assert.match(toolbarButton, /ariaHasPopup === undefined \|\| ariaHasPopup === false/u);
  assert.match(toolbarButton, /event\.key !== 'ContextMenu'/u);
  assert.match(toolbarButton, /event\.shiftKey === true && event\.key === 'F10'/u);
  assert.match(toolbarButton, /event\.currentTarget\.click\(\)/u);
  assert.match(toolbarButton, /event\.defaultPrevented/u);
});
