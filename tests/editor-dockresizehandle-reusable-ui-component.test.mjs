import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('DockResizeHandle owns bottom-dock resize interaction and accessibility', async () => {
  const component = await read('src/client/components/ui/DockResizeHandle.tsx');

  assert.match(component, /export interface DockResizeHandleProps/u);
  assert.match(component, /function DockResizeHandle\(/u);
  assert.match(component, /resizable = true/u);
  assert.match(component, /role='separator'/u);
  assert.match(component, /aria-orientation='horizontal'/u);
  assert.match(component, /aria-valuemin=\{valueMin\}/u);
  assert.match(component, /aria-valuemax=\{valueMax\}/u);
  assert.match(component, /aria-valuenow=\{Math\.round\(value\)\}/u);
  assert.match(component, /onValueChange\(clamped\)/u);
  assert.match(component, /onCommit\(clamped\)/u);
  assert.match(component, /event\.key === 'ArrowUp'/u);
  assert.match(component, /event\.key === 'ArrowDown'/u);
  assert.match(component, /event\.shiftKey \? 64 : 16/u);
});

test('DockResizeHandle is shared by Find and Terminal docks', async () => {
  const findDock = await read('src/client/components/search/FindToolDock.tsx');
  const terminalDock = await read('src/client/components/terminal/EditorTerminalDock.tsx');

  for (const dock of [findDock, terminalDock]) {
    assert.match(dock, /import \{ DockResizeHandle \} from '..\/ui\/DockResizeHandle';/u);
    assert.match(dock, /<DockResizeHandle/u);
    assert.doesNotMatch(dock, /window\.addEventListener\('mousemove', onMove\)/u);
  }
});
