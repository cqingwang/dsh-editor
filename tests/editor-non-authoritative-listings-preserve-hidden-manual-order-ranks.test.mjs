import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const pathModelSource = await readFile(
  new URL('../src/client/components/editor/editor-path-model.ts', import.meta.url),
  'utf8',
);
const source = workspaceSource + '\n' + terminalSource;

function extract(name) {
  return transpileTypeScriptFunction([pathModelSource, terminalSource].join('\n'), name);
}

const pruneExpanded = new Function(
  `${extract('dirname')}\n${extract('pruneProjectExpandedPaths')}\nreturn pruneProjectExpandedPaths;`,
)();
const pruneManualOrder = new Function(
  `${extract('dirname')}\n${extract('pruneProjectManualOrder')}\nreturn pruneProjectManualOrder;`,
)();

test('non-authoritative listings preserve hidden manual-order ranks', () => {
  const order = {
    '': ['README.md', '.env', 'src'],
    '.hidden': ['.hidden/file'],
  };
  assert.equal(
    pruneManualOrder({
      order,
      authoritative: false,
      rootEntries: [{ path: 'README.md' }, { path: 'src' }],
      children: {},
    }),
    order,
  );
});

test('authoritative listings still prune missing manual-order ranks', () => {
  const order = { '': ['README.md', 'deleted.txt'] };
  assert.deepEqual(
    pruneManualOrder({
      order,
      authoritative: true,
      rootEntries: [{ path: 'README.md' }],
      children: {},
    }),
    { '': ['README.md'] },
  );
});

test('non-authoritative listings preserve hidden expanded directories', () => {
  const expanded = new Set(['', '.hidden', '.hidden/nested']);
  assert.equal(
    pruneExpanded({
      expanded,
      authoritative: false,
      rootEntries: [{ path: 'src' }],
      children: {},
    }),
    expanded,
  );
});

test('workspace gates both pruners on the complete hidden/excluded listing', () => {
  const hiddenAt = source.indexOf("const [showHidden, setShowHidden]");
  const excludedAt = source.indexOf("const [showExcludedFiles, setShowExcludedFiles]");
  const authorityAt = source.indexOf('const listingAuthoritativeRef =');
  assert.ok(hiddenAt >= 0 && excludedAt > hiddenAt && authorityAt > excludedAt, 'authority ref must declare after both state hooks');
  assert.match(source, /listingAuthoritativeRef\.current = showHidden && showExcludedFiles;/u);
  assert.match(source, /const authoritative = listingAuthoritativeRef\.current;/u);
  assert.match(source, /pruneProjectExpandedPaths\(\{[\s\S]*?authoritative,/u);
  assert.match(source, /pruneProjectManualOrder\(\{[\s\S]*?authoritative,/u);
});
