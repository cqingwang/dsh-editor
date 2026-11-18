import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('An Editor file drop ends the host drag session instead of only hiding its mask', () => {
  const start = source.indexOf('function bindEditorFileDragCleanup()');
  const end = source.indexOf('const editorFileDragProps', start);
  const cleanup = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(cleanup, /event\?\.type === 'drop'/u);
  assert.match(cleanup, /target\?\.closest\?\.\('\[data-dsh-editor-workspace\]'\)/u);
  assert.match(cleanup, /window\.setTimeout\(\(\) => \{/u);
  assert.match(cleanup, /window\.dispatchEvent\(new Event\('dragend', \{ bubbles: true, cancelable: true \}\)\)/u);
  assert.match(cleanup, /document\.body\.classList\.remove\('dsh-editor-file-drag'\)/u);
  assert.doesNotMatch(cleanup, /\.remove\(\)/u);
});

test('Drops outside the Editor do not synthesize a host dragend', () => {
  const start = source.indexOf('function bindEditorFileDragCleanup()');
  const end = source.indexOf('const editorFileDragProps', start);
  const cleanup = source.slice(start, end);
  const branchStart = cleanup.indexOf("event?.type === 'drop'");
  const branchEnd = cleanup.indexOf('document.body.classList.remove', branchStart);
  const branch = cleanup.slice(branchStart, branchEnd);
  assert.match(branch, /closest\?\.\('\[data-dsh-editor-workspace\]'\)/u);
  assert.match(branch, /window\.setTimeout/u);
});
