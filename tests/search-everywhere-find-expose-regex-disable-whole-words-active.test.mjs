import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../lib/client.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

test('Search Everywhere and Find expose Regex and disable Whole Words while active', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(searchEverywhere, /label: t\('editor\.searchRegex'\)/);
  assert.match(searchEverywhere, /disabled: state\.regex === true/);
  assert.match(findToolWindow, /label: t\('editor\.searchRegex'\)/);
  assert.match(findToolWindow, /disabled: state\.regex === true/);
  assert.match(source, /regex: searchEverywhere\?\.regex === true/);
  assert.match(source, /regex: findTool\?\.regex === true/);
});

test('Regex state hands off to Find and every replace path forwards it', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const findToolOpen ='),
  );
  assert.match(searchEverywhere, /regex: state\.regex === true/);
  assert.match(openFind, /normalizeSearchOptions\(initial === null \? readSearchOptions\(\) : initial\)/);
  assert.match(openFind, /\.\.\.savedOptions/);
  assert.match(source, /regex: searchEverywhere\.regex === true/);
  assert.match(source, /regex: findTool\.regex === true/);
});

test('host searches with Unicode regex flags and smart case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round482-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'foo-12\nbar-7\nFOO-345\n', 'utf8');

  const insensitive = await host.searchWorkspaceText(root, 'foo-(\\d+)', {
    maxMatches: 20,
    regex: true,
  });
  assert.deepEqual(insensitive.matches.map((match) => [match.line, match.column]), [
    [1, 1],
    [3, 1],
  ]);

  const sensitive = await host.searchWorkspaceText(root, 'foo-(\\d+)', {
    maxMatches: 20,
    regex: true,
    caseSensitive: true,
  });
  assert.deepEqual(sensitive.matches.map((match) => [match.line, match.column]), [
    [1, 1],
  ]);
});

test('invalid or potentially explosive patterns fail before scanning', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round482-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'aaaa\n', 'utf8');

  await assert.rejects(
    () => host.searchWorkspaceText(root, '[', { regex: true }),
    /invalid regular expression/u,
  );
  await assert.rejects(
    () => host.searchWorkspaceText(root, '(a+)+$', { regex: true }),
    /regular expression is too complex/u,
  );
});

test('Regex Replace All expands captures and exact occurrence replaces one match', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round482-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'foo-12 bar-7 FOO-345\n', 'utf8');
  const info = await stat(path);

  const all = await host.replaceWorkspaceText(
    root,
    '(foo)-(\\d+)',
    '$1:$2',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { regex: true },
  );
  assert.equal(all.replacements, 2);
  assert.equal(await readFile(path, 'utf8'), 'foo:12 bar-7 FOO:345\n');

  const currentInfo = await stat(path);
  const one = await host.replaceWorkspaceText(
    root,
    '(foo):(\\d+)',
    'id-$2',
    [{ path: 'a.txt', mtime: currentInfo.mtimeMs }],
    { regex: true, occurrence: { line: 1, column: 1 } },
  );
  assert.equal(one.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'id-12 bar-7 FOO:345\n');
});
