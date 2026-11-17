import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Directory scope path shrinks before hiding picker or recursion actions', () => {
  const start = source.indexOf('findToolScopeDirectoryInput: {');
  const end = source.indexOf('\n      },', start);
  assert.ok(start >= 0 && end > start);
  const style = source.slice(start, end);
  assert.match(style, /minWidth: 0/u);
  assert.doesNotMatch(style, /minWidth: 120/u);
});

test('Directory scope keeps all direct controls after responsive shrink', () => {
  assert.match(source, /aria-label': t\('editor\.findScopeDirectory'\)/u);
  assert.match(source, /aria-label': t\('editor\.findSelectDirectory'\)/u);
  assert.match(source, /aria-label': t\('editor\.findScopeSearchRecursively'\)/u);
});
