import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const options = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

test('host sorting can mix directories and files when Folders Always on Top is off', () => {
  const entries = [
    { name: 'z.txt', kind: 'file', mtime: 100 },
    { name: 'm-dir', kind: 'directory', mtime: 1 },
    { name: 'a.txt', kind: 'file', mtime: 2 },
  ];
  assert.deepEqual(workspaceFileOperations.sort([...entries], 'name', true).map((entry) => entry.name), ['m-dir', 'a.txt', 'z.txt']);
  assert.deepEqual(workspaceFileOperations.sort([...entries], 'name', false).map((entry) => entry.name), ['a.txt', 'm-dir', 'z.txt']);
});

test('the FS list route forwards foldersFirst with a compatibility default', () => {
  assert.match(host, /function sortEntries\(entries, mode, foldersFirst = true\)/);
  assert.match(host, /sortEntries\(entries, options\.sort, options\.foldersFirst !== false\)/);
  assert.match(host, /foldersFirst: body\?\.foldersFirst !== false/);
});

test('Project stores Folders Always on Top independently and exposes it under Appearance', () => {
  assert.match(
    client,
    /const \[\s*foldersFirst,\s*setFoldersFirst,?\s*\] =\s+React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.foldersFirst', '1'\) !== '0'\)/,
  );
  assert.match(options, /id: 'foldersFirst',\s+label: t\('editor\.foldersAlwaysOnTop'\),\s+shortcut: foldersFirst \? '✓' : ''/);
  const appearance = options.slice(options.indexOf("id: 'appearance'"));
  assert.match(appearance, /id: 'foldersFirst'/);
});

test('every Project tree list request carries the foldersFirst preference', () => {
  const requests = client.match(/foldersFirst,\s+showExcluded: showExcludedFiles/g) ?? [];
  assert.ok(requests.length >= 7, `expected all Project list calls to carry foldersFirst, found ${requests.length}`);
});
