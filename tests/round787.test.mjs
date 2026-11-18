import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('ProjectPanel is an imported TSX feature component', async () => {
  const panel = await read('src/client/components/project/ProjectPanel.tsx');
  assert.doesNotMatch(panel, /React\.createElement/u);
  assert.match(panel, /import React from 'react'/u);
  assert.match(panel, /import \{ PanelToolbar \} from '\.\.\/ui\/PanelToolbar'/u);
  assert.match(panel, /<PanelToolbar/u);
  assert.match(panel, /<ContextMenu/u);
});

test('build compiles ProjectPanel TSX into the deployed factory', async () => {
  const build = await read('scripts/build-client.mjs');
  assert.match(build, /ProjectPanel\.tsx/u);
  assert.match(build, /@babel\/plugin-transform-typescript/u);
  assert.match(build, /projectPanelModule/u);
  const project = await read('src/client/project.ts');
  assert.doesNotMatch(project, /function ProjectPanel\(/u);
});
