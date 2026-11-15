import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Extract one top-level function body from the browser module.
 * @param {string} name - function declaration name.
 * @returns {Function} the evaluated function.
 */
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

test('Compact Directories follows only a continuous single-directory chain', () => {
  const compactDirectoryChain = extractFunction('compactDirectoryChain');
  const entry = { name: 'chain-a', path: 'chain-a', kind: 'directory' };
  const children = {
    'chain-a': [{ name: 'chain-b', path: 'chain-a/chain-b', kind: 'directory' }],
    'chain-a/chain-b': [{ name: 'deep', path: 'chain-a/chain-b/deep', kind: 'directory' }],
    'chain-a/chain-b/deep': [
      { name: 'one.txt', path: 'chain-a/chain-b/deep/one.txt', kind: 'file' },
      { name: 'two.txt', path: 'chain-a/chain-b/deep/two.txt', kind: 'file' },
    ],
  };
  const chain = compactDirectoryChain(entry, children);
  assert.equal(chain.path, 'chain-a/chain-b/deep');
  assert.equal(chain.name, 'chain-a/chain-b/deep');
  assert.equal(chain.kids.length, 2);
  assert.equal(chain.compacted, true);
});

test('Compact Directories stops at a sibling, file or unloaded directory', () => {
  const compactDirectoryChain = extractFunction('compactDirectoryChain');
  const entry = { name: 'branch-a', path: 'branch-a', kind: 'directory' };
  const branching = compactDirectoryChain(entry, {
    'branch-a': [
      { name: 'one.txt', path: 'branch-a/one.txt', kind: 'file' },
      { name: 'two', path: 'branch-a/two', kind: 'directory' },
    ],
  });
  assert.equal(branching.path, 'branch-a');
  assert.equal(branching.name, 'branch-a');
  assert.equal(branching.compacted, false);

  const unknown = compactDirectoryChain(entry, {});
  assert.equal(unknown.path, 'branch-a');
  assert.equal(unknown.kids, undefined);
  assert.equal(unknown.compacted, false);
});

test('Project stores Compact Directories off by default and exposes it under Appearance', () => {
  assert.match(
    source,
    /const \[compactDirectories, setCompactDirectories\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.compactDirectories', '0'\) === '1'\);/,
  );
  assert.match(source, /\{ id: 'compactDirectories', label: t\('editor\.compactDirectories'\), shortcut: compactDirectories \? '✓' : ''/);
  assert.match(source, /window\.localStorage\.setItem\('dsh-editor\.project\.compactDirectories', next \? '1' : '0'\)/);
  const appearance = source.slice(source.indexOf("id: 'appearance'"), source.indexOf('onCreateChange:', source.indexOf("id: 'appearance'")));
  assert.match(appearance, /id: 'compactDirectories'/);
});

test('flattenRows compacts loaded chains while preserving the deepest real path', () => {
  assert.match(source, /function flattenRows\(entries, children, expanded, projectName, root, compactDirectories = false\)/);
  assert.match(source, /const compacted = compactDirectories === true && entry\.kind === 'directory' \? compactDirectoryChain\(entry, children\) : null;/);
  assert.match(source, /const rowEntry = compacted === null[\s\S]*?path: compacted\.path,[\s\S]*?name: compacted\.name,/);
  assert.match(source, /rows\.push\(\{ \.\.\.rowEntry, depth, continues \}\);/);
});

test('expanding a loaded single-directory chain continues until it reaches content', () => {
  const start = source.indexOf('const toggleDirectory = React.useCallback(async (path) => {');
  assert.notEqual(start, -1);
  const body = source.slice(start, source.indexOf('}, [compactDirectories, expanded, foldersFirst', start));
  assert.match(body, /let chainPath = path;/);
  assert.match(body, /compactDirectories === true/);
  assert.match(body, /listing\.length === 1 && listing\[0\]\?\.kind === 'directory'/);
  assert.match(body, /hydration\[chainPath\] = nextListing/);
  assert.match(body, /expandedPaths\.push\(chainPath\)/);
  assert.match(source, /}, \[compactDirectories, expanded, foldersFirst/);
});

test('renaming a compact row edits the real directory basename, not its display chain', () => {
  assert.match(source, /run: \(\) => setRenameState\(\{ path: row\.path, value: basename\(row\.path\) \}\)/);
  assert.match(source, /setRenameState\(\{ path: current\.path, value: basename\(current\.path\) \}\)/);
});
