import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const source = await read('src/client/components/commit/log-menu.ts');
const { commitLogMenu } = loadTypeScriptModule(source, ['commitLogMenu']);
const t = (key) => key;

function itemById(menu, id) {
  for (const item of menu.items) {
    if (item?.id === id) return item;
    const child = item?.items?.find((entry) => entry?.id === id);
    if (child !== undefined) return child;
  }
  return null;
}

function buildMenu(overrides = {}) {
  return commitLogMenu({
    t,
    position: { x: 24, y: 48 },
    commit: { hash: 'abcdef123456', subject: 'subject' },
    selectionHashes: ['abcdef123456'],
    parentTargets: [],
    childTargets: [],
    detached: false,
    onShowCommit: () => {},
    onShowCommitHistory: () => {},
    onCompareRevisions: () => {},
    onCompareWithLocal: () => {},
    onRunHistoryAction: () => {},
    onCreateTag: () => {},
    onCreateCommitPatch: () => {},
    onCheckoutRevision: () => {},
    onCreateBranch: () => {},
    onResetBranchHere: () => {},
    onCopyText: () => {},
    ...overrides,
  });
}

test('Commit Log menu preserves single-row item order and disabled relations', () => {
  const menu = buildMenu();
  assert.equal(menu.x, 24);
  assert.equal(menu.y, 48);
  assert.deepEqual(
    menu.items.map((item) => item?.id ?? null),
    [
      'show',
      'history',
      'compareWithLocalCommit',
      null,
      'goToChildCommit',
      'goToParentCommit',
      null,
      'cherryPick',
      'revert',
      null,
      'createTag',
      'createCommitPatch',
      null,
      'checkoutRevision',
      'newBranchFromCommit',
      'resetBranchHere',
      null,
      'copyHash',
      'copySubject',
    ],
  );
  assert.equal(itemById(menu, 'compareRevisions'), null);
  assert.equal(itemById(menu, 'goToChildCommit')?.disabled, true);
  assert.equal(itemById(menu, 'goToParentCommit')?.disabled, true);
  assert.equal(itemById(menu, 'revert')?.danger, true);
  assert.equal(itemById(menu, 'resetBranchHere')?.disabled, false);
});

test('Commit Log menu exposes relation submenus and compare action', () => {
  const shown = [];
  const compared = [];
  const menu = buildMenu({
    selectionHashes: ['abcdef123456', '123456abcdef'],
    parentTargets: [
      { hash: '1111111aaaaa', subject: 'parent one' },
      { hash: '2222222bbbbb', subject: 'parent two' },
    ],
    childTargets: [{ hash: '3333333ccccc', subject: 'child' }],
    onShowCommit: (hash) => shown.push(hash),
    onCompareRevisions: (hashes) => compared.push(hashes),
  });
  assert.equal(itemById(menu, 'compareRevisions')?.label, 'editor.compareRevisionsAction');
  assert.equal(itemById(menu, 'goToChildCommit')?.disabled, false);
  assert.equal(itemById(menu, 'goToParentCommit')?.items?.length, 2);
  assert.equal(itemById(menu, 'goToParent:1111111aaaaa')?.label, '1111111 parent one');
  itemById(menu, 'compareRevisions').run();
  itemById(menu, 'goToChildCommit').run();
  itemById(menu, 'goToParent:2222222bbbbb').run();
  assert.deepEqual(compared, [['abcdef123456', '123456abcdef']]);
  assert.deepEqual(shown, ['3333333ccccc', '2222222bbbbb']);
});

test('Commit Log menu preserves history, prompt, reset and copy callbacks', () => {
  const calls = [];
  const menu = buildMenu({
    detached: true,
    onShowCommit: (hash) => calls.push(['show', hash]),
    onShowCommitHistory: (hash) => calls.push(['history', hash]),
    onCompareWithLocal: (hash) => calls.push(['compareLocal', hash]),
    onRunHistoryAction: (action, hash) => calls.push([action, hash]),
    onCreateTag: (hash) => calls.push(['tag', hash]),
    onCreateCommitPatch: (hash) => calls.push(['patch', hash]),
    onCheckoutRevision: (hash) => calls.push(['checkout', hash]),
    onCreateBranch: (hash) => calls.push(['branch', hash]),
    onResetBranchHere: (hash, mode) => calls.push([`reset:${mode}`, hash]),
    onCopyText: (value) => calls.push(['copy', value]),
  });
  assert.equal(itemById(menu, 'resetBranchHere')?.disabled, true);
  assert.equal(itemById(menu, 'newBranchFromCommit')?.label, 'editor.newBranchFromCommitAction');
  assert.equal(itemById(menu, 'copySubject')?.disabled, false);
  itemById(menu, 'show').run();
  itemById(menu, 'history').run();
  itemById(menu, 'compareWithLocalCommit').run();
  itemById(menu, 'cherryPick').run();
  itemById(menu, 'revert').run();
  itemById(menu, 'createTag').run();
  itemById(menu, 'createCommitPatch').run();
  itemById(menu, 'checkoutRevision').run();
  itemById(menu, 'newBranchFromCommit').run();
  itemById(menu, 'resetHard').run();
  itemById(menu, 'copyHash').run();
  itemById(menu, 'copySubject').run();
  assert.deepEqual(calls, [
    ['show', 'abcdef123456'],
    ['history', 'abcdef123456'],
    ['compareLocal', 'abcdef123456'],
    ['cherryPick', 'abcdef123456'],
    ['revert', 'abcdef123456'],
    ['tag', 'abcdef123456'],
    ['patch', 'abcdef123456'],
    ['checkout', 'abcdef123456'],
    ['branch', 'abcdef123456'],
    ['reset:hard', 'abcdef123456'],
    ['copy', 'abcdef123456'],
    ['copy', 'subject'],
  ]);
  const emptySubject = buildMenu({ commit: { hash: 'abcdef123456', subject: '' } });
  assert.equal(itemById(emptySubject, 'copySubject')?.disabled, true);
});

test('editor workspace reuses the extracted Commit Log menu builder', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(workspace, /import \{ commitLogMenu \} from '\.\/components\/commit\/log-menu';/u);
  assert.match(workspace, /commitLogMenu\(\{/u);
  assert.doesNotMatch(workspace, /id: 'compareRevisions'/u);
  assert.doesNotMatch(workspace, /id: 'goToParentCommit'/u);
  assert.match(build, /log-menu\.ts/u);
  assert.match(client, /function commitLogMenu\(/u);
});
