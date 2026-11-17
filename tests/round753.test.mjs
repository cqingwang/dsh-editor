import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = client.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('external-change reload chooses image metadata instead of text read', () => {
  const operation = new Function(
    `${extractFunction('workspaceReloadOperation')}; return workspaceReloadOperation;`,
  )();
  assert.equal(operation({ kind: 'image' }), 'image');
  assert.equal(operation({ kind: 'text' }), 'read');
  assert.equal(operation(null), 'read');
});

test('image reload preserves the tab kind and updates only media metadata', () => {
  const afterReload = new Function(
    `${extractFunction('workspaceFileAfterReload')}; return workspaceFileAfterReload;`,
  )();
  assert.deepEqual(
    afterReload(
      { path: 'a.png', kind: 'image', content: '', dirty: true, size: 10, mtime: 1, mediaType: 'image/png' },
      { size: 20, mtime: 2, mediaType: 'image/png' },
    ),
    { path: 'a.png', kind: 'image', content: '', dirty: false, size: 20, mtime: 2, mediaType: 'image/png' },
  );
  assert.deepEqual(
    afterReload(
      { path: 'a.txt', content: 'old', dirty: true, mtime: 1 },
      { content: 'new', mtime: 2 },
    ),
    { path: 'a.txt', content: 'new', dirty: false, mtime: 2 },
  );
});

test('both external-change paths ask the host for the correct operation', () => {
  assert.match(client, /workspaceReloadOperation\(file\)/u);
  assert.match(client, /workspaceFileAfterReload\(entry, value\)/u);
  const reloadStart = client.indexOf('const reloadActiveFromDisk = React.useCallback');
  const reloadEnd = client.indexOf('/**\n       * Reveal one path', reloadStart);
  const reload = client.slice(reloadStart, reloadEnd);
  assert.match(reload, /op: workspaceReloadOperation\(file\)/u);
  assert.doesNotMatch(reload, /const value = await callFs\(\{ op: 'read', path \}\);/u);
  const externalStart = client.indexOf('const checkExternalChanges = React.useCallback');
  const externalEnd = client.indexOf('/**\n       * Follow the workspace', externalStart);
  const external = client.slice(externalStart, externalEnd);
  assert.match(external, /workspaceReloadOperation\(file\)/u);
  assert.match(external, /workspaceFileAfterReload\(entry, value\)/u);
});
