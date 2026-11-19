import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('FindToolDock is a reusable TSX dock layout', async () => {
  const component = await read('src/client/components/search/FindToolDock.tsx');

  assert.match(component, /export interface FindToolDockProps/u);
  assert.match(component, /function FindToolDock\(/u);
  assert.match(component, /if \(!open\) return null;/u);
  assert.match(component, /resizable\?: boolean/u);
  assert.match(component, /resizable = true/u);
  assert.match(component, /import \{ DockResizeHandle \} from '..\/ui\/DockResizeHandle';/u);
  assert.match(component, /<DockResizeHandle/u);
  assert.match(component, /resizable=\{resizable\}/u);
  assert.match(component, /\.\.\.styles\.dock/u);
  assert.match(component, /data-dsh-find-tool-dock=''/u);
  assert.doesNotMatch(component, /window\.addEventListener\('mousemove', onMove\)/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ FindToolDock \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});
