import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

/**
 * Extract and evaluate one module-level helper from the client bundle.
 *
 * `flattenRows` is pure (it only walks arrays), so running the shipping code is
 * both possible and far stronger than matching its source text.
 * @param {string} name - helper name.
 * @returns {Function} the helper.
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

/** `flattenRows` now calls `continuationFlags`; both must share one scope. */
function loadFlattenRows() {
  const at = (name) => {
    const start = source.indexOf(`    function ${name}(`);
    assert.notEqual(start, -1, `${name} is missing`);
    let index = source.indexOf('{', start);
    let depth = 0;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) return source.slice(start, index + 1);
      }
    }
    throw new Error(`unbalanced braces in ${name}`);
  };
  return new Function(`'use strict';\n${at('continuationFlags')}\n${at('orderProjectEntriesByManual')}\n${at('flattenRows')}\nreturn flattenRows;`)();
}

const flattenRows = loadFlattenRows();

test('an expanded empty directory shows a placeholder row', () => {
  const rows = flattenRows(
    [{ name: 'empty', path: 'empty', kind: 'directory' }],
    { empty: [] },
    new Set(['', 'empty']),
    'ws',
    '/root',
  );
  assert.deepEqual(rows.map((row) => row.kind), ['directory', 'placeholder']);
  assert.equal(rows[1].depth, 1);
  assert.equal(rows[1].empty, true);
});

test('a still-loading directory shows nothing rather than an empty placeholder', () => {
  /* undefined means "children not fetched yet"; [] means "confirmed empty". */
  const rows = flattenRows([{ name: 'slow', path: 'slow', kind: 'directory' }], {}, new Set(['', 'slow']), 'ws', '/root');
  assert.deepEqual(rows.map((row) => row.name), ['slow']);
});

test('a bare workspace shows the placeholder at the root', () => {
  const rows = flattenRows([], {}, new Set(['']), 'ws', '/root');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'placeholder');
  assert.equal(rows[0].depth, 0);
});

test('a collapsed directory never emits a placeholder', () => {
  const rows = flattenRows([{ name: 'empty', path: 'empty', kind: 'directory' }], { empty: [] }, new Set(['']), 'ws', '/root');
  assert.deepEqual(rows.map((row) => row.kind), ['directory']);
});

test('the placeholder row is not selectable and cannot be dragged', () => {
  /* Keyboard navigation filters placeholders out; a selectable ghost row would break selection. */
  assert.match(source, /const selectable = rows\.filter\(\(row\) => row\.kind !== 'placeholder'\);/);
  assert.match(source, /row\.kind === 'placeholder'/);
  assert.match(source, /t\('editor\.emptyDirectory'\)/);
});

test('dragging a row inside a multi-row selection moves the whole selection', () => {
  assert.match(source, /const payload = selection\.has\(row\.path\) && selection\.size > 1/);
  assert.match(source, /event\.dataTransfer\?\.setData\('text\/plain', payload\.join\('\\n'\)\);/);
  /* The drop side splits one-path-per-line and moves each entry. */
  assert.match(source, /const sources = \(event\.dataTransfer\?\.getData\('text\/plain'\) \?\? ''\)\.split\('\\n'\)/);
  /* Round 51 replaced the inline filter/loop with one all-or-nothing plan. */
  assert.match(source, /const plan = planMoves\(sources, targetDirectory, existing\);/);
});

test('a multi-row move refuses to drop a directory into itself', () => {
  /* The refusal is decided by the planner, before any rename runs. */
  assert.match(source, /if \(plan\.intoSelf\.length > 0\) setTreeError\(t\('editor\.moveIntoSelf'\)\);/);
  const start = source.indexOf('    function planMoves(');
  assert.notEqual(start, -1);
  const body = source.slice(start, start + 2600);
  assert.match(body, /target === source \|\| target\.startsWith\(`\$\{source\}\/`\)/);
});

test('open tabs follow a moved directory, not just a moved file', () => {
  const client = source;
  assert.match(client, /function remapPathAfterMove\(path, entries\)/);
  assert.match(client, /if \(path\.startsWith\(`\$\{from\}\/`\)\) return `\$\{to\}\$\{path\.slice\(from\.length\)\}`;/);
  assert.match(client, /remapEditorPaths\(entries\);/);
});

test('a commit switches to the log and marks the new row', () => {
  assert.match(source, /const \[highlightedCommit, setHighlightedCommit\] = React\.useState\(null\);/);
  assert.match(source, /setHighlightedCommit\(head\);/);
  assert.match(source, /setCommitMode\('log'\);/);
  assert.match(source, /\.\.\.\(highlighted === commit\.hash \? \{ 'data-dsh-log-new': '' \} : null\)/);
  assert.match(source, /\[data-dsh-log-new\] \{ background:/);
});
