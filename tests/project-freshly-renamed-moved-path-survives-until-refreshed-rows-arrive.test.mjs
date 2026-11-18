import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const pathSource = await readFile(new URL('../src/client/components/editor/editor-path-model.ts', import.meta.url), 'utf8');
const dirname = new Function(`${transpileTypeScriptFunction(pathSource, 'dirname')}; return dirname;`)();
const projectSelectionAfterRowsChange = new Function(
  'dirname',
  `${transpileTypeScriptFunction(terminalSource, 'projectSelectionAfterRowsChange')}
   return projectSelectionAfterRowsChange;`,
)(dirname);

test('a freshly renamed or moved path survives until the refreshed rows arrive', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/renamed.js',
      previousPaths: ['src', 'src/app.js'],
      rowPaths: ['src', 'src/app.js'],
      expanded: new Set(['', 'src']),
    }),
    'src/renamed.js',
  );
});

test('an old path that existed before the refresh still falls back after removal', () => {
  assert.equal(
    projectSelectionAfterRowsChange({
      selectedPath: 'src/app.js',
      previousPaths: ['src', 'src/app.js', 'src/nav.js'],
      rowPaths: ['src', 'src/nav.js'],
      expanded: new Set(['', 'src']),
    }),
    'src/nav.js',
  );
});
