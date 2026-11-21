import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, ['filterProjectSpeedSearchRows']);

const rows = [
  { path: '', name: 'workspace', kind: 'directory' },
  { path: 'src', name: 'src', kind: 'directory' },
  { path: 'src/visible.ts', name: 'visible.ts', kind: 'file' },
  { path: '.DS_Store', name: '.DS_Store', kind: 'file' },
  { path: 'nested/Thumbs.db', name: 'Thumbs.db', kind: 'file' },
  { path: 'nested/desktop.ini', name: 'desktop.ini', kind: 'file' },
  { path: 'build/main.o', name: 'main.o', kind: 'file' },
  { path: 'build/module.class', name: 'module.class', kind: 'file' },
  { path: 'build/object.obj', name: 'object.obj', kind: 'file' },
];

test('an empty query keeps system files visible in the Project tree', () => {
  assert.deepEqual(
    helpers.filterProjectSpeedSearchRows(rows, '').map((row) => row.path),
    rows.map((row) => row.path),
  );
});

test('local speed search never returns system-generated files as hits', () => {
  for (const query of ['.ds_store', 'thumbs', 'desktop.ini', '.o', '.class', '.obj']) {
    const filtered = helpers.filterProjectSpeedSearchRows(rows, query);
    assert.equal(
      filtered.some((row) => /(?:^|\/)(?:\.ds_store|thumbs\.db|desktop\.ini|main\.o|module\.class|object\.obj)$/iu.test(row.path)),
      false,
      `${query} leaked a system-generated file`,
    );
  }
});

test('ordinary local hits still retain their ancestor directories', () => {
  assert.deepEqual(
    helpers.filterProjectSpeedSearchRows(rows, 'visible').map((row) => row.path),
    ['', 'src', 'src/visible.ts'],
  );
});
