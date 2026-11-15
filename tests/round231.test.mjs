import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

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

const rows = [
  { path: '', name: 'project', kind: 'directory' },
  { path: 'src', name: 'src', kind: 'directory' },
  { path: 'src/Alpha.ts', name: 'Alpha.ts', kind: 'file' },
  { path: 'src/readme.md', name: 'readme.md', kind: 'file' },
  { path: 'docs', name: 'docs', kind: 'directory' },
  { path: 'docs/target.md', name: 'target.md', kind: 'file' },
  { path: 'docs/target-copy.md', name: 'target-copy.md', kind: 'file' },
  { path: 'empty', name: 'empty', kind: 'placeholder' },
];

test('speed-search matches only real hit rows, not retained ancestor directories', () => {
  const hitRows = extractFunction('speedSearchHitRows');
  assert.deepEqual(hitRows(rows, 'target').map((row) => row.path), ['docs/target.md', 'docs/target-copy.md']);
  assert.deepEqual(hitRows(rows, 'SRC/').map((row) => row.path), []);
  assert.deepEqual(hitRows(rows, ' '), []);
});

test('speed-search navigation stays on hits and cycles with arrow keys', () => {
  const hitRowsSource = (() => {
    const start = source.indexOf('function speedSearchHitRows(');
    assert.notEqual(start, -1);
    const end = source.indexOf('function speedSearchTarget(', start);
    assert.notEqual(end, -1);
    return source.slice(start, end);
  })();
  const targetSource = (() => {
    const start = source.indexOf('function speedSearchTarget(');
    assert.notEqual(start, -1);
    const end = source.indexOf('function treeSearchMiss(', start);
    assert.notEqual(end, -1);
    return source.slice(start, end);
  })();
  const target = new Function(`${hitRowsSource}\n${targetSource}; return speedSearchTarget;`)();
  assert.equal(target(rows, 'target', null, 'first'), 'docs/target.md');
  assert.equal(target(rows, 'target', 'src/Alpha.ts', 'first'), 'docs/target.md');
  assert.equal(target(rows, 'target', 'docs/target.md', 'next'), 'docs/target-copy.md');
  assert.equal(target(rows, 'target', 'docs/target-copy.md', 'next'), 'docs/target.md');
  assert.equal(target(rows, 'target', 'docs/target.md', 'previous'), 'docs/target-copy.md');
  assert.equal(target(rows, 'missing', 'docs/target.md', 'next'), null);
});

test('typing selects the first hit and arrow keys move within the search box', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /speedSearchHitRows\(visibleRows, search\)/);
  assert.match(panel, /speedSearchTarget\(visibleRows, search, selectedPath/);
  assert.match(panel, /event\.key === 'ArrowDown'/);
  assert.match(panel, /event\.key === 'ArrowUp'/);
  assert.match(panel, /selectSearchHit\(/);
});

test('Enter opens the selected hit, not always the first filtered row', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /const hits = React\.useMemo\(\(\) => speedSearchHitRows\(visibleRows, search\)/);
  assert.match(panel, /const hit = hits\.find\(\(row\) => row\.path === selectedPath\) \?\? hits\[0\]/);
});
