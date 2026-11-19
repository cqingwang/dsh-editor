import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const modelSource = await readFile(new URL('src/client/components/project/workspace-directory-model.ts', root), 'utf8');
const pickerSource = await readFile(
  new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root),
  'utf8',
);
const helpers = loadTypeScriptModule(modelSource, ['workspaceDirectoryPickerGeometry']);

test('directory picker geometry keeps a 16px viewport margin at any width', () => {
  assert.deepEqual(helpers.workspaceDirectoryPickerGeometry(360, 600), {
    x: 16,
    y: 20,
    width: 328,
    height: 560,
  });
  assert.deepEqual(helpers.workspaceDirectoryPickerGeometry(320, 240), {
    x: 16,
    y: 16,
    width: 288,
    height: 208,
  });
  assert.deepEqual(helpers.workspaceDirectoryPickerGeometry(900, 800), {
    x: 70,
    y: 120,
    width: 760,
    height: 560,
  });
});

test('the picker consumes the shared viewport-safe geometry helper', () => {
  assert.match(pickerSource, /workspaceDirectoryPickerGeometry\(window\.innerWidth, window\.innerHeight\)/u);
  assert.doesNotMatch(pickerSource, /Math\.max\(360, Math\.min\(760/u);
});
