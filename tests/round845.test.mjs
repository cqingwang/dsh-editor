import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('FindToolPopup is a reusable TSX floating surface', async () => {
  const component = await read('src/client/components/search/FindToolPopup.tsx');

  assert.match(component, /export interface FindToolPopupGeometry/u);
  assert.match(component, /export interface FindToolPopupProps/u);
  assert.match(component, /function FindToolPopup\(/u);
  assert.match(component, /if \(!open \|\| children === null\) return null;/u);
  assert.match(component, /data-dsh-find-tool-popup=''/u);
  assert.match(component, /left: geometry\.x/u);
  assert.match(component, /top: geometry\.y/u);
  assert.match(component, /width: geometry\.width/u);
  assert.match(component, /height: geometry\.height/u);
  assert.match(component, /React\.cloneElement\(children/u);
  assert.match(component, /onPopupDragStart/u);
  assert.match(component, /onPopupResizeStart/u);
  assert.match(component, /export \{ FindToolPopup \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds FindToolPopup and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/find-tool-popup.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /FindToolPopup\.tsx/u);
  assert.match(build, /findToolPopupModule/u);
  assert.doesNotMatch(workspace, /React\.cloneElement\(findToolWindowElement, \{/u);
  assert.match(workspace, /<FindToolPopup/u);
  assert.match(workspace, /<FindToolPopup[\s\S]*?open=\{findTool !== null && findTool\.surface !== 'dock'\}/u);
  assert.match(workspace, /<FindToolPopup[\s\S]*?geometry=\{findToolPopupGeometry\}/u);
  assert.match(workspace, /<FindToolPopup[\s\S]*?\{findToolWindowElement\}/u);
  assert.match(fixture, /FIND_TOOL_POPUP_END/u);
  assert.match(client, /function FindToolPopup\(/u);
  assert.match(client, /React\.createElement\(FindToolPopup, \{/u);
});
