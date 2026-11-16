import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the host search finds names below collapsed directories without leaving its budget', async (t) => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-editor-r242-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));
  await mkdir(join(workspace, 'docs', 'nested'), { recursive: true });
  await mkdir(join(workspace, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(workspace, 'docs', 'note.txt'), 'note\n');
  await writeFile(join(workspace, 'docs', 'nested', 'another-note.md'), 'note\n');
  await writeFile(join(workspace, '.hidden-note.txt'), 'note\n');
  await writeFile(join(workspace, 'node_modules', 'pkg', 'note.js'), 'note\n');

  const found = await workspaceFileOperations.search(workspace, 'note', {
    showHidden: false,
    showExcluded: true,
  });
  assert.deepEqual(found.entries.map((entry) => entry.path).sort(), [
    'docs/nested/another-note.md',
    'docs/note.txt',
  ]);
  assert.ok(found.entries.every((entry) => entry.kind === 'file'));
  assert.equal(found.truncated, false);

  const hidden = await workspaceFileOperations.search(workspace, 'hidden-note', {
    showHidden: true,
    showExcluded: false,
  });
  assert.deepEqual(hidden.entries.map((entry) => entry.path), ['.hidden-note.txt']);
});

test('search hits are rendered through the existing tree flattener with their ancestors', () => {
  const helpers = new Function(
    `'use strict';\n${extract('basename')}\n${extract('dirname')}\n${extract('continuationFlags')}\n${extract('compactDirectoryChain')}\n${extract('flattenRows')}\n${extract('searchEntryRows')}\nreturn { searchEntryRows };`,
  )();
  const rows = helpers.searchEntryRows([
    { path: 'docs/note.txt', name: 'note.txt', kind: 'file' },
    { path: 'docs/nested/another-note.md', name: 'another-note.md', kind: 'file' },
  ], 'workspace');
  assert.deepEqual(rows.map((row) => row.path), ['docs', 'docs/note.txt', 'docs/nested', 'docs/nested/another-note.md']);
  assert.deepEqual(rows.map((row) => row.kind), ['directory', 'file', 'directory', 'file']);
  assert.deepEqual(rows.map((row) => row.depth), [0, 1, 1, 2]);
});

test('Project speed search requests host matches and feeds the existing navigation helpers', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /op: 'search'/);
  assert.match(panel, /const requestId = \+\+searchRequestRef\.current/);
  assert.match(panel, /searchEntryRows\(searchEntries, projectName, compactDirectories\)/);
  assert.match(panel, /speedSearchHitRows\(visibleRows, search\)/);
  assert.match(panel, /speedSearchTarget\(visibleRows, search, selectedPath/);
  assert.match(panel, /treeSearchMiss\(\{ query: search, rows: visibleRows, loading: searchPending \}\)/);
});

test('the host fs route exposes search beside the existing list operation', () => {
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  assert.match(host, /case 'search':\s+return ok\(await searchWorkspaceEntries\(root, body\?\.query/);
  assert.match(host, /workspaceFileOperations = \{[\s\S]*?search: searchWorkspaceEntries,[\s\S]*?searchText: searchWorkspaceText,[\s\S]*?replaceText: replaceWorkspaceText \}/);
});
