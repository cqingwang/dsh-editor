import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('patch download filename is stable and filesystem-safe', () => {
  const fn = new Function(`${extractFunction('patchDownloadName')}; return patchDownloadName;`)();
  assert.equal(fn(new Date(2026, 10, 15, 1, 2, 3)), 'dsh-editor-changes-20261115-010203.patch');
});

test('Create Patch reuses the selected patch request and downloads a Blob', () => {
  assert.ok(source.includes("createPatchFromChanges: '从本地更改创建补丁…'"));
  assert.ok(source.includes("createPatchFromChanges: 'Create Patch from Local Changes…'"));
  assert.match(source, /const requestSelectedPatch = React\.useCallback\(/);
  assert.match(source, /op: 'patch', entries/);
  assert.match(source, /const createSelectedPatch = React\.useCallback\(/);
  assert.match(source, /new Blob\(\[value\.patch\], \{ type: 'text\/x-patch;charset=utf-8' \}\)/);
  assert.match(source, /anchor\.download = patchDownloadName\(\)/);
  assert.match(source, /URL\.revokeObjectURL\(url\)/);
});

test('Create Patch is available from toolbar, row menu and group menu', () => {
  assert.match(source, /id: 'createPatch'/);
  assert.match(source, /id: 'createPatchFromChanges'/);
  assert.match(source, /label: t\('editor\.createPatchFromChanges'\)/);
  assert.match(source, /onCreatePatch/);
});
