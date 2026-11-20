import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const builder = source.slice(
  source.indexOf('const openProjectViewMenu = ('),
  source.indexOf('const positionForProjectRow', source.indexOf('const openProjectViewMenu = (')),
);

test('the Project View menu exposes the current view as checked', () => {
  assert.match(builder, /active: definition\.id === projectView,/u);
  assert.match(builder, /shortcut: definition\.id === projectView \? '✓' : '',/u);
});
