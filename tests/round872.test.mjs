import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const terminal = await read('src/client/terminal.ts');
const helpers = loadTypeScriptModule(terminal, [
  'countOccurrences',
  'editorApplyPreserveCase',
  'editorFindResult',
  'editorReplaceAll',
  'editorReplaceAt',
  'findMatches',
  'filterTreeRows',
  'highlightParts',
  'normalizeTextSearchContextFilter',
  'reconcileTerminalDockState',
  'terminalActiveAfterClose',
  'textOffsetAtLineColumn',
  'textSearchContextAllows',
  'textSearchContextMask',
  'textSearchContextRulesForPath',
  'textSearchFileMatches',
]);

test('TypeScript terminal helpers preserve editor Find and replacement behavior', () => {
  assert.deepEqual(helpers.editorFindResult('Alpha alpha', 'alpha', { caseSensitive: true }).matches, [
    { offset: 6, length: 5, text: 'alpha' },
  ]);
  assert.deepEqual(helpers.findMatches('a a', 'a'), [0, 2]);
  assert.equal(helpers.countOccurrences('a a', 'a'), 2);
  assert.equal(helpers.editorApplyPreserveCase('HELLO', 'world'), 'WORLD');
  assert.equal(helpers.editorApplyPreserveCase('Hello', 'world'), 'World');
  assert.equal(helpers.editorReplaceAll('one two one', 'one', 'three').text, 'three two three');
  assert.deepEqual(helpers.editorReplaceAt('one two one', 'one', 'three', 8), {
    text: 'one two three',
    count: 1,
    replacementText: 'three',
    length: 3,
    error: null,
  });
  assert.equal(helpers.textOffsetAtLineColumn('a\nbc\n', 2, 2), 3);
  assert.equal(helpers.textSearchFileMatches('src/a.ts', 'one two one', 'one', {}, 1).matches.length, 2);
});

test('TypeScript terminal helpers preserve lexical context and Project helpers', () => {
  assert.equal(helpers.normalizeTextSearchContextFilter('comments'), 'comments');
  assert.equal(helpers.normalizeTextSearchContextFilter('invalid'), 'anywhere');
  assert.equal(helpers.textSearchContextRulesForPath('src/app.ts')?.lineComments?.[0], '//');
  assert.equal(helpers.textSearchContextRulesForPath('README.unknown'), null);
  const mask = helpers.textSearchContextMask('const x = "needle"; // needle\n', 'src/a.ts');
  assert.equal(helpers.textSearchContextAllows(mask, 11, 6, 'strings'), true);
  assert.equal(helpers.textSearchContextAllows(mask, 23, 6, 'comments'), true);
  const rows = [
    { path: '', name: 'project', kind: 'directory' },
    { path: 'src', name: 'src', kind: 'directory' },
    { path: 'src/app.ts', name: 'app.ts', kind: 'file' },
    { path: 'README.md', name: 'README.md', kind: 'file' },
  ];
  assert.deepEqual(
    helpers.filterTreeRows(rows, 'app').map((row) => row.path),
    ['', 'src', 'src/app.ts'],
  );
  assert.deepEqual(helpers.highlightParts('app.ts', 'ap'), [
    { text: 'ap', match: true },
    { text: 'p.ts', match: false },
  ]);
  const listed = [{ id: 'dock-a' }, { id: 'dock-b' }, { id: 'editor-a' }];
  assert.equal(helpers.terminalActiveAfterClose(listed, 'dock-a', ['editor-a']), 'dock-b');
  assert.deepEqual(helpers.reconcileTerminalDockState(listed, ['editor-a', 'missing'], 'editor-a'), {
    editorIds: ['editor-a'],
    activeId: 'dock-a',
  });
});

test('terminal.js is deleted from source and frozen as a test oracle', async () => {
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');
  const packageJson = JSON.parse(await read('package.json'));

  assert.equal(existsSync(new URL('../src/client/terminal.js', import.meta.url)), false);
  assert.equal(existsSync(new URL('../tests/fixtures/legacy/terminal.legacy.js', import.meta.url)), true);
  assert.match(build, /'terminal\.ts'/u);
  assert.doesNotMatch(build, /'terminal\.js'/u);
  assert.match(client, /\/\* ─────────────────────── terminal\.ts ─────────────────────── \*\//u);
  assert.doesNotMatch(client, /\/\* ─────────────────────── terminal\.js ─────────────────────── \*\//u);
  assert.equal(existsSync(new URL('../src/client/terminal.js.bak', import.meta.url)), false);
});
