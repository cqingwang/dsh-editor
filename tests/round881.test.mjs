import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/file-menu.ts');
const { commitFileMenu } = loadTypeScriptModule(source, ['commitFileMenu']);
const t = (key) => key;

function itemById(menu, id) {
  return menu.items.find((item) => item.id === id) ?? null;
}

test('Commit Log file menu preserves order and availability states', () => {
  const menu = commitFileMenu({
    t,
    position: { x: 18, y: 36 },
    path: 'src/app.ts',
    hash: '',
    localExists: false,
    localDirExists: false,
    absoluteClipboardPath: "'/repo/src/app.ts'",
    onShowDiff: () => {},
    onOpenRepositoryVersion: () => {},
    onRevealPath: () => {},
    onOpenTerminal: () => {},
    onEditLocalVersion: () => {},
    onShowFileHistory: () => {},
    onCopyText: () => {},
  });

  assert.equal(menu.x, 18);
  assert.equal(menu.y, 36);
  assert.deepEqual(
    menu.items.map((item) => item.id),
    [
      'diff',
      'openRepositoryVersion',
      'reveal',
      'openTerminal',
      'openLocalVersion',
      'history',
      'copyRelative',
      'copyAbsolute',
    ],
  );
  assert.equal(itemById(menu, 'diff')?.disabled, true);
  assert.equal(itemById(menu, 'openRepositoryVersion')?.disabled, true);
  assert.equal(itemById(menu, 'openTerminal')?.disabled, true);
  assert.equal(itemById(menu, 'openLocalVersion')?.disabled, true);
  assert.equal(itemById(menu, 'openLocalVersion')?.shortcut, 'F4');
});

test('Commit Log file menu dispatches revision, reveal, terminal, history and copy actions', () => {
  const calls = [];
  const menu = commitFileMenu({
    t,
    position: { x: 20, y: 40 },
    path: 'src/app.ts',
    hash: 'abcdef123456',
    localExists: true,
    localDirExists: true,
    absoluteClipboardPath: "'/repo/src/app.ts'",
    onShowDiff: (target) => calls.push(['diff', target]),
    onOpenRepositoryVersion: (target) => calls.push(['repositoryVersion', target]),
    onRevealPath: (path) => calls.push(['reveal', path]),
    onOpenTerminal: (path) => calls.push(['terminal', path]),
    onEditLocalVersion: (path) => calls.push(['editLocal', path]),
    onShowFileHistory: (path) => calls.push(['history', path]),
    onCopyText: (value) => calls.push(['copy', value]),
  });

  assert.equal(itemById(menu, 'diff')?.disabled, false);
  assert.equal(itemById(menu, 'openRepositoryVersion')?.disabled, false);
  assert.equal(itemById(menu, 'openTerminal')?.disabled, false);
  assert.equal(itemById(menu, 'openLocalVersion')?.disabled, false);
  itemById(menu, 'diff').run();
  itemById(menu, 'openRepositoryVersion').run();
  itemById(menu, 'reveal').run();
  itemById(menu, 'openTerminal').run();
  itemById(menu, 'openLocalVersion').run();
  itemById(menu, 'history').run();
  itemById(menu, 'copyRelative').run();
  itemById(menu, 'copyAbsolute').run();
  assert.deepEqual(calls, [
    ['diff', { hash: 'abcdef123456', path: 'src/app.ts' }],
    ['repositoryVersion', { hash: 'abcdef123456', path: 'src/app.ts' }],
    ['reveal', 'src/app.ts'],
    ['terminal', 'src/app.ts'],
    ['editLocal', 'src/app.ts'],
    ['history', 'src/app.ts'],
    ['copy', 'src/app.ts'],
    ['copy', "'/repo/src/app.ts'"],
  ]);
});

test('editor workspace reuses the extracted Commit Log file menu builder', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(workspace, /declare const commitFileMenu:/u);
  assert.match(workspace, /commitFileMenu\(\{/u);
  assert.match(workspace, /absoluteClipboardPath: shellQuote\(root === '' \? path : `\$\{root\}\/\$\{path\}`\)/u);
  assert.doesNotMatch(workspace, /id: 'openRepositoryVersion'/u);
  assert.match(build, /file-menu\.ts/u);
  assert.match(client, /function commitFileMenu\(/u);
});
