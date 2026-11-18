import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../lib/client.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

test('Search Everywhere and Find expose Whole Words and forward it', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(searchEverywhere, /label: t\('editor\.searchWholeWords'\)/);
  assert.match(searchEverywhere, /onToggleWholeWords/);
  assert.match(findToolWindow, /label: t\('editor\.searchWholeWords'\)/);
  assert.match(findToolWindow, /onToggleWholeWords/);
  assert.match(source, /wholeWords: searchEverywhere\?\.wholeWords === true/);
  assert.match(source, /wholeWords: findTool\?\.wholeWords === true/);
});

test('Whole Words state survives the Search Everywhere to Find handoff', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const openFind = source.slice(
    source.indexOf('const openFindTool = React.useCallback'),
    source.indexOf('const findToolOpen ='),
  );
  assert.match(searchEverywhere, /wholeWords: state\.wholeWords === true/);
  assert.match(openFind, /normalizeSearchOptions\(initial === null \? readSearchOptions\(\) : initial\)/);
  assert.match(openFind, /\.\.\.savedOptions/);
});

test('host search respects ASCII and Unicode word boundaries', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round481-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'cat concatenate cats cat_cat cat\n猫。猫 猫猫\n', 'utf8');

  const ordinary = await host.searchWorkspaceText(root, 'cat', { maxMatches: 20 });
  assert.equal(ordinary.matches.length > 4, true);

  const words = await host.searchWorkspaceText(root, 'cat', { maxMatches: 20, wholeWords: true });
  assert.deepEqual(words.matches.map((match) => [match.line, match.column]), [
    [1, 1],
    [1, 30],
  ]);

  const cjk = await host.searchWorkspaceText(root, '猫', { maxMatches: 20, wholeWords: true });
  assert.deepEqual(cjk.matches.map((match) => [match.line, match.column]), [
    [2, 1],
    [2, 3],
  ]);
});

test('Replace in Files applies Whole Words to every write path', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round481-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'cat concatenate cats cat_cat cat\n猫。猫 猫猫\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    'cat',
    'dog',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { wholeWords: true },
  );
  assert.equal(result.replacements, 2);
  assert.equal(await readFile(path, 'utf8'), 'dog concatenate cats cat_cat dog\n猫。猫 猫猫\n');

  const currentInfo = await stat(path);
  await assert.rejects(
    () => host.replaceWorkspaceText(
      root,
      'cat',
      'pet',
      [{ path: 'a.txt', mtime: currentInfo.mtimeMs }],
      { wholeWords: true, occurrence: { line: 1, column: 8 } },
    ),
    /search result no longer matches/u,
  );
  assert.equal(await readFile(path, 'utf8'), 'dog concatenate cats cat_cat dog\n猫。猫 猫猫\n');
});
