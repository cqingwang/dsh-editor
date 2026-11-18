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
  assert.match(component, /\.\.\.styles\.dock/u);
  assert.match(component, /data-dsh-find-tool-dock=''/u);
  assert.match(component, /\.\.\.styles\.dockResize/u);
  assert.match(component, /onHeightChange\(latest\)/u);
  assert.match(component, /onCommit\(latest\)/u);
  assert.match(component, /\{children\}/u);
  assert.match(component, /export \{ FindToolDock \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds FindToolDock and the workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/find-tool-dock.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /FindToolDock\.tsx/u);
  assert.match(build, /findToolDockModule/u);
  assert.match(workspace, /<FindToolDock/u);
  assert.match(workspace, /<FindToolDock[\s\S]*?open=\{findTool\?\.surface === 'dock' && terminalOpen === false\}/u);
  assert.match(workspace, /<FindToolDock[\s\S]*?clampHeight=\{clampFindDockHeight\}/u);
  assert.match(
    workspace,
    /<FindToolDock[\s\S]*?onCommit=\{\(final\) => writeStoredNumber\('dsh-editor\.find\.height', final\)\}/u,
  );
  assert.match(workspace, /<FindToolDock[\s\S]*?\{findToolWindowElement\}/u);
  assert.match(fixture, /FIND_TOOL_DOCK_END/u);
  assert.match(client, /function FindToolDock\(/u);
  assert.match(client, /React\.createElement\(FindToolDock, \{/u);
});
