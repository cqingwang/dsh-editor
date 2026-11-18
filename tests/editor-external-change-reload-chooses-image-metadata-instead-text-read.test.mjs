import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const workspaceFileModel = await readFile(
  new URL('../src/client/components/editor/workspace-file-model.ts', import.meta.url),
  'utf8',
);

test('external-change reload chooses image metadata instead of text read', () => {
  const operation = loadTypeScriptFunction(workspaceFileModel, 'workspaceReloadOperation');
  assert.equal(operation({ kind: 'image' }), 'image');
  assert.equal(operation({ kind: 'text' }), 'read');
  assert.equal(operation(null), 'read');
});

test('image reload preserves the tab kind and updates only media metadata', () => {
  const afterReload = loadTypeScriptFunction(workspaceFileModel, 'workspaceFileAfterReload');
  assert.deepEqual(
    afterReload(
      { path: 'a.png', kind: 'image', content: '', dirty: true, size: 10, mtime: 1, mediaType: 'image/png' },
      { size: 20, mtime: 2, mediaType: 'image/png' },
    ),
    { path: 'a.png', kind: 'image', content: '', dirty: false, size: 20, mtime: 2, mediaType: 'image/png' },
  );
  assert.deepEqual(
    afterReload({ path: 'a.txt', content: 'old', dirty: true, mtime: 1 }, { content: 'new', mtime: 2 }),
    { path: 'a.txt', content: 'new', dirty: false, mtime: 2 },
  );
});

test('host read and image responses create the correct tab shape', () => {
  const fromResponse = loadTypeScriptFunction(workspaceFileModel, 'workspaceFileFromResponse');
  assert.deepEqual(fromResponse('a.txt', { content: 'hello', mtime: 7 }, false), {
    path: 'a.txt',
    content: 'hello',
    dirty: false,
    mtime: 7,
  });
  assert.deepEqual(fromResponse('a.png', { size: 42, mtime: 8, mediaType: 'image/png' }, true), {
    path: 'a.png',
    content: '',
    dirty: false,
    mtime: 8,
    kind: 'image',
    size: 42,
    mediaType: 'image/png',
  });
});

test('both external-change paths ask the host for the correct operation', () => {
  assert.match(client, /workspaceReloadOperation\(file\)/u);
  assert.match(client, /workspaceFileAfterReload\(entry, value\)/u);
  const reloadStart = client.indexOf('const reloadActiveFromDisk = React.useCallback');
  const reloadEnd = client.indexOf('/**\n       * Make one path visible', reloadStart);
  const reload = client.slice(reloadStart, reloadEnd);
  assert.match(reload, /op: workspaceReloadOperation\(file\)/u);
  assert.doesNotMatch(reload, /const value = await callFs\(\{ op: 'read', path \}\);/u);
  const externalStart = client.indexOf('const checkExternalChanges = React.useCallback');
  const externalEnd = client.indexOf('/**\n       * Follow the workspace', externalStart);
  const external = client.slice(externalStart, externalEnd);
  assert.match(external, /workspaceReloadOperation\(file\)/u);
  assert.match(external, /workspaceFileAfterReload\(entry, value\)/u);
});
