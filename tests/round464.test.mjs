import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = await readSource(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('double Shift remains registered but routes to the shared Find handler', () => {
  const action = extract('doubleShiftAction');
  const shift = { key: 'Shift', repeat: false, metaKey: false, ctrlKey: false, altKey: false };
  assert.deepEqual(action(0, shift, 100), { lastAt: 100, open: false });
  assert.deepEqual(action(100, shift, 450), { lastAt: 0, open: true });
  assert.deepEqual(action(100, 'Shift', 450), { lastAt: 0, open: false });
  assert.match(source, /openFindInFilesFromShortcut/);
  const doubleShiftEffect = source.slice(
    source.indexOf('/* Double Shift remains a registered alias'),
    source.indexOf('React.useEffect(() => {\n        searchEverywhereFilesRequestRef', source.indexOf('/* Double Shift remains a registered alias')),
  );
  assert.doesNotMatch(doubleShiftEffect, /openSearchEverywhere\('all'\)/);
  assert.match(doubleShiftEffect, /openFindInFilesFromShortcut\(\)/);
});

test('Search Everywhere exposes IDEA tabs and search/replace command entries', () => {
  assert.match(source, /function SearchEverywhere\(/);
  assert.match(source, /'data-dsh-search-everywhere': ''/);
  for (const tab of ['all', 'files', 'text', 'actions']) {
    assert.match(source, new RegExp(`id: '${tab}'|searchEverywhereTabs[^\\n]*'${tab}'`));
  }
  assert.match(source, /label: t\('editor\.findAction'\)/);
  assert.match(source, /label: t\('editor\.replaceAction'\)/);
  assert.match(source, /label: t\('editor\.findInFilesAction'\)/);
  assert.match(source, /label: t\('editor\.replaceInFilesAction'\)/);
  const actions = source.slice(
    source.indexOf('const searchEverywhereActions = React.useMemo'),
    source.indexOf('/* Recompute match count'),
  );
  const find = actions.indexOf("label: t('editor.findAction')");
  const replace = actions.indexOf("label: t('editor.replaceAction')");
  const findInFiles = actions.indexOf("label: t('editor.findInFilesAction')");
  const replaceInFiles = actions.indexOf("label: t('editor.replaceInFilesAction')");
  assert.ok(find > 0 && replace > find && findInFiles > replace && replaceInFiles > findInFiles);
  assert.match(source, /doubleShiftAction\(/);
  assert.match(source, /next\.open[\s\S]*?openFindInFilesFromShortcut\(\)/);
  assert.match(source, /openFindInFilesFromShortcut\(/);
  assert.match(source, /const openFileAtLocation = React\.useCallback/);
  assert.match(source, /openFileAtLocation\(result\.path, result\.line, result\.column\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'f'/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'r'/);
});

test('current-file replace exposes IDEA Meta+R and a single replace command', () => {
  assert.match(source, /const replaceCurrent = React\.useCallback/);
  assert.match(source, /t\('editor\.replaceCurrent'\)/);
  assert.match(source, /event\.key\.toLowerCase\(\) === 'r'/);
  assert.match(source, /const hasExplicitQuery = typeof initialQuery === 'string'/);
  assert.match(source, /const find = hasExplicitQuery \? requestedFind : base\.find/);
  assert.match(source, /const request = editorFindKeyboardRequest\(editor\)/);
  assert.match(source, /openEditorFindInSelection\(request\.scope, withReplace, request\.query, focusTarget\)/);
});

test('host searches workspace text in bounded files and returns line locations', async (t) => {
  assert.equal(typeof host.searchWorkspaceText, 'function');
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-search-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), 'Alpha\nbeta alpha\n', 'utf8');
  await writeFile(join(root, 'b.md'), 'nothing\n', 'utf8');
  const result = await host.searchWorkspaceText(root, 'alpha', { maxMatches: 20 });
  assert.equal(result.matches.length, 2);
  assert.deepEqual(result.matches.map((match) => [match.path, match.line, match.column]), [
    ['a.txt', 1, 1],
    ['a.txt', 2, 6],
  ]);
  assert.equal(result.truncated, false);
});

test('host replace-in-files guards mtime and updates only matching text', async (t) => {
  assert.equal(typeof host.replaceWorkspaceText, 'function');
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-replace-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'Alpha beta alpha\n', 'utf8');
  const info = await stat(path);
  const result = await host.replaceWorkspaceText(root, 'alpha', 'omega', [
    { path: 'a.txt', mtime: info.mtimeMs },
  ]);
  assert.equal(result.changedFiles, 1);
  assert.equal(result.replacements, 2);
  assert.equal(await readFile(path, 'utf8'), 'omega beta omega\n');

  await assert.rejects(
    () => host.replaceWorkspaceText(root, 'omega', 'x', [{ path: 'a.txt', mtime: info.mtimeMs - 1000 }]),
    /changed on disk/u,
  );
  assert.equal(await readFile(path, 'utf8'), 'omega beta omega\n');
});
