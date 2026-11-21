import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const host = await import('../lib/index.js');
const editorCoreSource = await readFile(new URL('../src/client/editor-core.ts', import.meta.url), 'utf8');
const localesSource = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const findToolSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const { searchTextFailureMessage } = loadTypeScriptModule(editorCoreSource, ['searchTextFailureMessage']);

test('a missing Directory scope is rejected instead of reported as zero matches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-missing-directory-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    host.searchWorkspaceText(root, 'needle', {
      directory: 'definitely-missing-directory',
      maxMatches: 20,
    }),
    /search directory does not exist: definitely-missing-directory/u,
  );
});

test('absolute and escaping Directory paths are rejected as invalid scopes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-invalid-directory-scope-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['../outside', '/tmp/outside', 'src//nested']) {
    await assert.rejects(
      host.searchWorkspaceText(root, 'needle', {
        directory,
        maxMatches: 20,
      }),
      new RegExp(`invalid search directory scope: ${directory.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`, 'u'),
    );
  }
});

test('the missing Directory scope error is localized', () => {
  const message = searchTextFailureMessage(
    new Error('search directory does not exist: definitely-missing-directory'),
    (key, params) => `${key}:${params?.path ?? ''}`,
  );
  assert.equal(message, 'editor.findToolDirectoryMissing:definitely-missing-directory');
  assert.match(localesSource, /findToolDirectoryMissing: '搜索目录不存在：\{path\}'/u);
  assert.match(localesSource, /findToolDirectoryMissing: 'Search directory does not exist: \{path\}'/u);
  assert.match(findToolSource, /const showEmptyFindResult =/u);
  assert.match(
    findToolSource,
    /state\.error === null &&[\s\S]*?hasFindToolContentQuery\(query\) && occurrences\.length === 0/u,
  );
  assert.match(findToolSource, /\{showEmptyFindResult \? \(/u);
});

test('an invalid Directory path is localized', () => {
  const message = searchTextFailureMessage(
    new Error('invalid search directory scope: ../outside'),
    (key, params) => `${key}:${params?.path ?? ''}`,
  );
  assert.equal(message, 'editor.findToolDirectoryInvalid:../outside');
  assert.match(localesSource, /findToolDirectoryInvalid: '搜索目录路径无效：\{path\}'/u);
  assert.match(localesSource, /findToolDirectoryInvalid: 'Invalid search directory path: \{path\}'/u);
});
