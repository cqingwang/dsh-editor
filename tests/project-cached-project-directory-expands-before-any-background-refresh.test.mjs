import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const toggleStart = source.indexOf('const toggleDirectory = React.useCallback');
const toggleEnd = source.indexOf('/* Open a file, reusing its existing tab.', toggleStart);
const toggle = source.slice(toggleStart, toggleEnd);

test('a cached Project directory expands before any background refresh', () => {
  assert.ok(toggleStart >= 0 && toggleEnd > toggleStart);
  assert.match(
    toggle,
    /const cached = Array\.isArray\(childrenRef\.current\[path\]\)[\s\S]*?if \(cached !== null\) \{[\s\S]*?setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\);[\s\S]*?const listingValue = await callFs\(\{ op: 'list', path,/,
  );
});

test('an uncached directory waits for at most its own direct listing', () => {
  assert.match(toggle, /const listingValue = await callFs\(\{ op: 'list', path,/);
  assert.match(toggle, /const listing = Array\.isArray\(listingValue\?\.entries\) \? listingValue\.entries : \[\];/);
  assert.match(toggle, /setChildren\(\(current\) =>/);
  assert.match(toggle, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\);/);
  assert.doesNotMatch(toggle, /await prefetchDirectorySubtrees/);
});

test('one-level prefetch is a non-blocking background cache fill', () => {
  assert.match(toggle, /void prefetchDirectorySubtrees\(/);
  assert.match(toggle, /PROJECT_PREFETCH_DEPTH/);
  assert.match(toggle, /treeRootRef\.current !== workspaceRoot/);
  assert.match(toggle, /setChildren\(\(current\) =>/);
  assert.doesNotMatch(
    toggle,
    /prefetchDirectorySubtrees[\s\S]*?setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.Objects/,
  );
});
