import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const menu = await readFile(new URL('../src/client/components/project/project-options-menu.ts', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Project tree creation stays in the root context menu instead of the header menu', () => {
  assert.doesNotMatch(menu, /id: 'newFile'|id: 'newFolder'/);
  assert.doesNotMatch(panel, /overflowMenuItems=/);
  assert.match(panel, /projectMenuItems: MenuEntry\[\]/);
  assert.match(workspace, /id: 'newFile',[\s\S]*?run: \(\) => startCreate\('file', createParent\)/);
  assert.match(workspace, /id: 'newFolder',[\s\S]*?run: \(\) => startCreate\('directory', createParent\)/);
});
