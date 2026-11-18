import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

/**
 * Extract one module-level helper and evaluate it in Node.
 * @param {string} name - helper to load.
 * @returns {Function} the shipping implementation.
 */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`'use strict';\n${source.slice(start, index + 1)}\nreturn ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const collectFilePaths = load('collectFilePaths');

test('collectFilePaths keeps files only and ignores junk entries', () => {
  const paths = collectFilePaths([
    { path: 'a.txt', kind: 'file' },
    { path: 'src', kind: 'directory' },
    { path: 'b.txt', kind: 'file' },
    { kind: 'file' },
    null,
    undefined,
    { path: 42, kind: 'file' },
  ]);
  assert.deepEqual(paths, ['a.txt', 'b.txt']);
  assert.deepEqual(collectFilePaths(null), []);
  assert.deepEqual(collectFilePaths('nope'), []);
});

test('the first refresh establishes a baseline instead of marking everything new', () => {
  /* Without this guard, every file would flash green on the first load. */
  assert.match(source, /if \(known === null\) \{/);
  /* The baseline must come from the freshly fetched listing, not the render snapshot. */
  assert.match(source, /knownPathsRef\.current = new Set\(collectFilePaths\(listing \?\? \[\]\)\);/);
  assert.match(source, /const listing = await loadRoot\(\);/);
  assert.match(source, /First refresh only establishes the baseline: nothing is "new" yet\./);
});

test('a path stops being new once it disappears from the listing', () => {
  assert.match(source, /for \(const path of visible\) if \(!known\.has\(path\)\) next\.add\(path\);/);
  assert.match(source, /for \(const path of \[\.\.\.next\]\) if \(!visible\.has\(path\)\) next\.delete\(path\);/);
});

test('the tree tints a newly appeared file', () => {
  assert.match(source, /const \[newPaths, setNewPaths\] = React\.useState\(\(\) => new Set\(\)\);/);
  assert.match(source, /newPaths\?\.has\?\.\(row\.path\) \? \{ color: '#1a7f37' \} : null/);
  assert.match(source, /newPaths,/);
});

test('⌘⇧T reopens the most recently closed terminal', () => {
  assert.match(source, /const closedHistoryRef = React\.useRef\(closedHistory\);/);
  assert.match(source, /if \(meta && event\.shiftKey && !event\.altKey && event\.key\.toLowerCase\(\) === 't'\) \{/);
  assert.match(source, /const recent = closedHistoryRef\.current\[0\];/);
  assert.match(source, /void reopenClosed\(recent\);/);
  /* No history means the shortcut is a no-op rather than an empty tab. */
  assert.match(source, /if \(recent === undefined\) return;/);
});

test('the new-file baseline is established on initial load, not on the first refresh', () => {
  const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
  /* Without this, the first refresh only re-baselines and reports nothing new. */
  assert.match(source, /if \(knownPathsRef\.current === null\) knownPathsRef\.current = new Set\(collectFilePaths\(listing\)\);/);
  /* loadRoot must hand its listing back so refreshTree does not read a stale snapshot. */
  assert.match(source, /return listing;/);
  assert.match(source, /const listing = await loadRoot\(\);/);
});
