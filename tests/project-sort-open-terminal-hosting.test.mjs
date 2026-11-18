import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('directory listings sort by name, type or modification time', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-sort-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'b.md'), 'x');
  await writeFile(join(dir, 'a.txt'), 'x');
  await writeFile(join(dir, 'c.json'), 'x');

  const entries = [
    { name: 'b.md', kind: 'file', mtime: 3 },
    { name: 'a.txt', kind: 'file', mtime: 2 },
    { name: 'c.json', kind: 'file', mtime: 1 },
  ];
  assert.deepEqual(workspaceFileOperations.sort([...entries], 'name').map((entry) => entry.name), ['a.txt', 'b.md', 'c.json']);
  assert.deepEqual(workspaceFileOperations.sort([...entries], 'type').map((entry) => entry.name), ['c.json', 'b.md', 'a.txt']);
  assert.deepEqual(workspaceFileOperations.sort([...entries], 'modified').map((entry) => entry.name), ['b.md', 'a.txt', 'c.json']);
});

test('sort mode keeps directories ahead of files in every ordering', () => {
  const entries = [
    { name: 'z.txt', kind: 'file', mtime: 100 },
    { name: 'a-dir', kind: 'directory', mtime: 1 },
  ];
  assert.deepEqual(workspaceFileOperations.sort(entries, 'modified').map((entry) => entry.name), ['a-dir', 'z.txt']);
});

test('project menu exposes open-in-terminal and reveal-in-file-manager', () => {
  const client = `${read('src/client/editor-workspace.tsx')}\n${read('src/client/components/project/ProjectPanel.tsx')}`;
  const host = read('lib/index.js');
  assert.match(client, /id: 'openTerminal'/);
  assert.match(client, /id: 'revealFinder'/);
  assert.match(client, /editor\.openInTerminal/);
  assert.match(client, /editor\.revealInFinder/);
  assert.match(host, /async function revealInFileManager/);
  assert.match(host, /case 'reveal':/);
  assert.match(host, /execFile\(command, args, \{ detached: true \}\)/);
});

test('open in terminal starts the shell in the requested subdirectory', () => {
  const client = `${read('src/client/components/terminal/TerminalPanel.tsx')}\n${read('src/client/editor-workspace.tsx')}`;
  const host = read('lib/index.js');
  /* Round 123 added an explicit directory parameter; the ambient start directory is
     still the fallback when no directory is given. */
  assert.match(client, /shellPath === undefined && typeof startDirectory === 'string'/);
  assert.match(client, /startPath:\s+typeof directory === 'string' && directory !== ''/);
  assert.match(host, /const startPath = typeof body\?\.startPath === 'string'/);
  assert.match(host, /cwd = resolveInside\(root, startPath\)/);
});

test('sort preference persists per browser and reloads through the toolbar', () => {
  const client = [
    read('src/client/components/project/ProjectPanel.tsx'),
    read('src/client/editor-workspace.tsx'),
    read('src/client/components/project/project-options-menu.ts'),
    read('src/client/terminal.ts'),
  ].join('\n');
  assert.match(client, /function readStoredText/);
  assert.match(client, /dsh-editor\.project\.sort/);
  assert.match(client, /const cycleSort = React\.useCallback/);
  assert.match(client, /editor\.sort_/);
});
