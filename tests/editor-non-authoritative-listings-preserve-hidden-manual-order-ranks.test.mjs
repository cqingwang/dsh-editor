import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
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
  const authorityAt = source.indexOf('const listingAuthoritativeRef = React.useRef(showHidden && showExcludedFiles);');
  assert.ok(hiddenAt >= 0 && excludedAt > hiddenAt && authorityAt > excludedAt, 'authority ref must declare after both state hooks');
  assert.match(source, /listingAuthoritativeRef\.current = showHidden && showExcludedFiles;/u);
  assert.match(source, /const authoritative = listingAuthoritativeRef\.current;/u);
  assert.match(source, /pruneProjectExpandedPaths\(\{[\s\S]*?authoritative,/u);
  assert.match(source, /pruneProjectManualOrder\(\{[\s\S]*?authoritative,/u);
});
