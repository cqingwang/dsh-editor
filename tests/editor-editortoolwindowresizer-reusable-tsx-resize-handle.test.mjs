import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorToolWindowResizer is a reusable TSX resize handle', async () => {
  const component = await read('src/client/components/editor/EditorToolWindowResizer.tsx');

  assert.match(component, /export interface EditorToolWindowResizerProps/u);
  assert.match(component, /function EditorToolWindowResizer\(/u);
  assert.match(component, /style=\{styles\.sideResize\}/u);
  assert.match(component, /onMouseDown=\{onMouseDown\}/u);
  assert.match(component, /Math\.max\(14, Math\.min\(72, startWidth \+ delta\)\)/u);
  assert.match(component, /onWidthChange\(latest\)/u);
  assert.match(component, /onCommit\(latest\)/u);
  assert.match(component, /export \{ EditorToolWindowResizer \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
