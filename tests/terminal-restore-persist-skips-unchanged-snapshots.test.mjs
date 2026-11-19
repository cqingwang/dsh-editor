import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const source = await read('src/client/terminal.ts');
const { terminalRestoreSnapshotsEqual } = loadTypeScriptModule(source, ['terminalRestoreSnapshotsEqual']);

test('equal restore snapshots avoid another sessionStorage write', async () => {
  assert.equal(terminalRestoreSnapshotsEqual(['a', 'b'], ['a', 'b']), true);
  assert.equal(terminalRestoreSnapshotsEqual(['a', 'b'], ['a', 'c']), false);
  assert.equal(terminalRestoreSnapshotsEqual(['a'], ['a', 'b']), false);

  const start = source.indexOf('export function persistTerminalRestoreSnapshots');
  const end = source.indexOf('\n}', start) + 2;
  const persist = source.slice(start, end);
  assert.match(persist, /if \(terminalRestoreSnapshotsEqual\(snapshots, previous\)\) return;/u);
  assert.ok(persist.indexOf('terminalRestoreSnapshotsEqual') < persist.indexOf('writeTerminalRestoreSnapshots'));
});
