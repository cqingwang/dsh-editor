import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('include non-project items searches excluded workspace directories only', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-include-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'visible.txt'), 'outside needle\n', 'utf8');
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true });
  await writeFile(join(root, 'node_modules', 'pkg', 'hidden.txt'), 'excluded needle\n', 'utf8');

  const normal = await host.searchWorkspaceText(root, 'needle', { maxMatches: 20 });
  assert.deepEqual(normal.matches.map((match) => match.path), ['visible.txt']);
  const included = await host.searchWorkspaceText(root, 'needle', { maxMatches: 20, includeExcluded: true });
  assert.deepEqual(included.matches.map((match) => match.path).sort(), [
    'node_modules/pkg/hidden.txt',
    'visible.txt',
  ]);
});

test('include non-project items only reuses bounded workspace scans', () => {
  assert.match(hostSource, /includeExcluded/);
  assert.match(hostSource, /body\?\.includeExcluded === true/);
});

test('Search Everywhere exposes the IDEA include non-project items toggle', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /includeNonProject/);
  assert.match(dialog, /t\('editor\.includeNonProjectItems'\)/);
  assert.match(dialog, /onToggleIncludeNonProject/);
  assert.match(source, /op: 'files', includeExcluded:/);
  assert.match(source, /includeExcluded: searchEverywhere\?\.includeNonProject === true/);
});
