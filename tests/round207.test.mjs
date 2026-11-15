import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project sort supports both IDEA modification-time directions', () => {
  const entries = [
    { name: 'middle.txt', kind: 'file', mtime: 20 },
    { name: 'oldest.txt', kind: 'file', mtime: 10 },
    { name: 'newest.txt', kind: 'file', mtime: 30 },
  ];
  assert.deepEqual(
    workspaceFileOperations.sort([...entries], 'modified').map((entry) => entry.name),
    ['newest.txt', 'middle.txt', 'oldest.txt'],
  );
  assert.deepEqual(
    workspaceFileOperations.sort([...entries], 'modified-asc').map((entry) => entry.name),
    ['oldest.txt', 'middle.txt', 'newest.txt'],
  );
});

test('modification-time direction still honours Folders Always on Top', () => {
  const entries = [
    { name: 'new-file.txt', kind: 'file', mtime: 30 },
    { name: 'old-dir', kind: 'directory', mtime: 10 },
  ];
  assert.deepEqual(
    workspaceFileOperations.sort(entries, 'modified-asc', true).map((entry) => entry.name),
    ['old-dir', 'new-file.txt'],
  );
  assert.deepEqual(
    workspaceFileOperations.sort(entries, 'modified-asc', false).map((entry) => entry.name),
    ['old-dir', 'new-file.txt'],
  );
});

test('Project Appearance exposes newest-first and oldest-first as separate choices', () => {
  const appearance = client.slice(client.indexOf("id: 'appearance'"), client.indexOf('onCreateChange:', client.indexOf("id: 'appearance'")));
  assert.match(appearance, /\['name', 'type', 'modified', 'modified-asc'\]/);
  assert.match(client, /sort_modified_asc:/);
  assert.match(client, /sort_modified: '按修改时间（最新优先）'/);
  assert.match(client, /sort_modified_asc: '按修改时间（最早优先）'/);
  assert.match(appearance, /const labelMode = mode === 'modified-asc' \? 'modified_asc' : mode;/);
});

test('the toolbar cycle visits both modification-time directions', () => {
  assert.match(client, /const order = \['name', 'type', 'modified', 'modified-asc'\];/);
  assert.match(client, /order\[\(order\.indexOf\(current\) \+ 1\) % order\.length\]/);
});
