import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorToolWindowResizer is a reusable TSX resize handle', async () => {
  const component = await read('src/client/components/editor/EditorToolWindowResizer.tsx');

  assert.match(component, /export interface EditorToolWindowResizerProps/u);
  assert.match(component, /function EditorToolWindowResizer\(/u);
  assert.match(component, /TOOL_WINDOW_WIDTH_MIN_PERCENT = 14/u);
  assert.match(component, /TOOL_WINDOW_WIDTH_MAX_PERCENT = 72/u);
  assert.match(component, /style=\{styles\.sideResize\}/u);
  assert.match(component, /role='separator'/u);
  assert.match(component, /aria-orientation='vertical'/u);
  assert.match(component, /aria-valuemin=\{TOOL_WINDOW_WIDTH_MIN_PERCENT\}/u);
  assert.match(component, /aria-valuemax=\{TOOL_WINDOW_WIDTH_MAX_PERCENT\}/u);
  assert.match(component, /aria-valuenow=\{Math\.round\(widthPercent\)\}/u);
  assert.match(component, /tabIndex=\{0\}/u);
  assert.match(component, /onMouseDown=\{onMouseDown\}/u);
  assert.match(component, /onKeyDown=\{onKeyDown\}/u);
  assert.match(component, /event\.key === 'ArrowLeft'/u);
  assert.match(component, /event\.key === 'ArrowRight'/u);
  assert.match(component, /event\.shiftKey \? 10 : 2/u);
  assert.match(component, /onWidthChange\(latest\)/u);
  assert.match(component, /onCommit\(latest\)/u);
  assert.match(component, /export \{ EditorToolWindowResizer \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
