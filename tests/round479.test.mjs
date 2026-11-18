import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../lib/client.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

test('Search Everywhere and Find expose one Match Case option', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(searchEverywhere, /label: t\('editor\.searchMatchCase'\)/);
  assert.match(searchEverywhere, /onToggleCaseSensitive/);
  assert.match(findToolWindow, /label: t\('editor\.searchMatchCase'\)/);
  assert.match(findToolWindow, /onToggleCaseSensitive/);
});

test('search requests and both replace paths carry the same case option', () => {
  assert.match(source, /caseSensitive: searchEverywhere\?\.caseSensitive === true \? true : undefined/);
  assert.match(source, /caseSensitive: findTool\?\.caseSensitive === true \? true : undefined/);
  assert.match(source, /caseSensitive: searchEverywhere\.caseSensitive === true \? true : undefined/);
  assert.match(source, /caseSensitive: findTool\.caseSensitive === true \? true : undefined/);
});

test('Open in Find Tool Window carries the active Match Case state', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const findToolOpen ='),
  );
  assert.match(searchEverywhere, /caseSensitive: state\.caseSensitive === true/);
  assert.match(openFind, /normalizeSearchOptions\(initial === null \? readSearchOptions\(\) : initial\)/);
  assert.match(openFind, /\.\.\.savedOptions/);
});

test('workspace search keeps smart case unless Match Case forces exact case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round479-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'Alpha alpha ALPHA\n', 'utf8');

  const smart = await host.searchWorkspaceText(root, 'alpha', { maxMatches: 20 });
  assert.equal(smart.matches.length, 3);

  const exact = await host.searchWorkspaceText(root, 'alpha', { maxMatches: 20, caseSensitive: true });
  assert.deepEqual(exact.matches.map((match) => [match.path, match.line, match.column]), [
    ['a.txt', 1, 7],
  ]);
});

test('Replace in Files obeys the same explicit case option', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round479-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'Alpha alpha ALPHA\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    'alpha',
    'omega',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { caseSensitive: true },
  );
  assert.equal(result.changedFiles, 1);
  assert.equal(result.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'Alpha omega ALPHA\n');
});
