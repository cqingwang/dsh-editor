import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Find scope normalization keeps only representable IDEA values', () => {
  const normalize = new Function(
    `${extractFunction('normalizeFindSearchScope')}; return normalizeFindSearchScope;`,
  )();
  assert.deepEqual(normalize({ mode: 'directory', preset: 'changedFiles', directory: './src/' }), {
    mode: 'directory',
    preset: 'changedFiles',
    directory: 'src',
  });
  assert.deepEqual(normalize({ mode: 'scope', preset: 'openFiles', directory: 'ignored' }), {
    mode: 'scope',
    preset: 'openFiles',
    directory: '',
  });
  assert.deepEqual(normalize({ mode: 'directory', directory: '../outside' }), {
    mode: 'project',
    preset: 'projectFiles',
    directory: '',
  });
  assert.equal(normalize({ mode: 'directory', directory: 'src//generated' }).mode, 'project');
});

test('Find scope is stored per workspace and restored when the tool opens', () => {
  assert.match(source, /function findScopeStorageKey\(root\)/);
  assert.match(source, /dsh-editor\.find\.scope\.v1:/);
  assert.match(source, /function readFindScope\(root\)/);
  assert.match(source, /function writeFindScope\(root, scope\)/);
  assert.match(source, /const savedScope = readFindScope\(rootRef\.current\)/);
  assert.match(source, /searchScopeMode: savedScope\.mode/);
  assert.match(source, /searchScopePreset: savedScope\.preset/);
  assert.match(source, /searchScopeDirectory: savedScope\.directory/);
});

test('Every scope change persists the same normalized scope used for the search', () => {
  const changeScope = source.slice(
    source.indexOf('const changeFindToolScope = React.useCallback'),
    source.indexOf('const openBlankReplaceInFilesFromEditor = React.useCallback'),
  );
  assert.match(changeScope, /writeFindScope\(rootRef\.current/);
  assert.match(changeScope, /mode,/);
  assert.match(changeScope, /preset,/);
  assert.match(changeScope, /directory,/);
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
