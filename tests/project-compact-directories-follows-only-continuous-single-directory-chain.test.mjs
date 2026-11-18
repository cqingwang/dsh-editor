import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const optionsSource = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const source = [terminalSource, workspaceSource, optionsSource].join('\n');

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
    workspaceSource,
    /const \[\s*compactDirectories,\s*setCompactDirectories,?\s*\] = React\.useState\(\s*\(\) => readStoredText\('dsh-editor\.project\.compactDirectories', '0'\) === '1',?\s*\)/,
  );
  assert.match(
    optionsSource,
    /id: 'compactDirectories',\s+label: t\('editor\.compactDirectories'\),\s+shortcut: compactDirectories \? '✓' : ''/,
  );
  assert.match(workspaceSource, /window\.localStorage\.setItem\('dsh-editor\.project\.compactDirectories', next \? '1' : '0'\)/);
  const appearance = optionsSource.slice(optionsSource.indexOf("id: 'appearance'"));
  assert.match(appearance, /id: 'compactDirectories'/);
});

test('flattenRows compacts loaded chains while preserving the deepest real path', () => {
  assert.match(terminalSource, /function flattenRows\(/u);
  assert.match(terminalSource, /compactDirectories = false,/u);
  assert.match(terminalSource, /sortMode = 'name'/u);
  assert.match(terminalSource, /manualOrder = null/u);
  assert.match(
    terminalSource,
    /const compacted =\s*compactDirectories === true && entry\.kind === 'directory'\s+\? compactDirectoryChain\(entry, children\) : null;/u,
  );
  assert.match(
    terminalSource,
    /const rowEntry =\s*compacted === null[\s\S]*?path: compacted\.path,[\s\S]*?name: compacted\.name/u,
  );
  assert.match(terminalSource, /rows\.push\(\{ \.\.\.rowEntry, depth: frame\.depth, continues \}\);/);
});

test('expanding a compact chain uses the same bounded one-level lazy traversal', () => {
  const start = workspaceSource.indexOf('const toggleDirectory = React.useCallback(');
  assert.notEqual(start, -1);
  const body = workspaceSource.slice(start, workspaceSource.indexOf('/* Open a file, reusing its existing tab. */', start));
  assert.match(body, /compactDirectoryExpansionPaths\(/);
  assert.match(body, /prefetchDirectorySubtrees\(\s*\[path\]/);
  assert.match(body, /PROJECT_PREFETCH_DEPTH/);
  assert.match(body, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, \.\.\.expandedPaths\]\)\)/);
});

test('renaming a compact row edits the real directory basename, not its display chain', () => {
  assert.match(workspaceSource, /run: \(\) => setRenameState\(\{ path: row\.path, value: basename\(row\.path\) \}\)/);
  assert.match(workspaceSource, /setRenameState\(\{[\s\S]*?path: current\.path,[\s\S]*?value: basename\(current\.path\),/u);
});
