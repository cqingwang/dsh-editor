import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const hunkAt = load('hunkAt');
const typeaheadMatch = load('typeaheadMatch');
/** Same loader, but typeaheadStep reads the module-level reset constant. */
function loadWithReset(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        const reset = /const TYPEAHEAD_RESET_MS = (\d+);/.exec(source);
        assert.notEqual(reset, null, 'TYPEAHEAD_RESET_MS must stay a literal');
        return new Function(
          `const TYPEAHEAD_RESET_MS = ${reset[1]};\n${typeaheadMatch.toString()}\n${source.slice(start, index + 1)}; return ${name};`,
        )();
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}
const typeaheadStep = loadWithReset('typeaheadStep');

/* ── IDEA's diff toolbar: hunk position and F7 navigation ────────────────── */

test('the hunk counter names the hunk the caret sits in', () => {
  const changes = [
    { modifiedStartLineNumber: 3, modifiedEndLineNumber: 5 },
    { modifiedStartLineNumber: 12, modifiedEndLineNumber: 12 },
    { modifiedStartLineNumber: 40, modifiedEndLineNumber: 44 },
  ];
  /* IDEA numbers the first difference from 1 even before the caret enters it;
     `0/N` is only correct for a file with no differences at all. */
  assert.deepEqual(hunkAt(changes, 1), { index: 1, total: 3 });
  assert.deepEqual(hunkAt(changes, 3), { index: 1, total: 3 });
  assert.deepEqual(hunkAt(changes, 5), { index: 1, total: 3 });
  assert.deepEqual(hunkAt(changes, 12), { index: 2, total: 3 });
  assert.deepEqual(hunkAt(changes, 43), { index: 3, total: 3 });
});

test('a pure deletion still owns the line it was removed at', () => {
  /* Monaco reports an empty modified range for a deletion: start === end. Reading
     it as "no lines" hid the hunk from the counter exactly where the user was. */
  assert.deepEqual(hunkAt([{ modifiedStartLineNumber: 7, modifiedEndLineNumber: 7 }], 7), { index: 1, total: 1 });
});

test('between hunks the counter keeps the hunk above', () => {
  /* IDEA's gutter never shows `0/3` while you are deep in a changed file. */
  const changes = [
    { modifiedStartLineNumber: 2, modifiedEndLineNumber: 3 },
    { modifiedStartLineNumber: 30, modifiedEndLineNumber: 31 },
  ];
  assert.deepEqual(hunkAt(changes, 20), { index: 1, total: 2 });
  /* Above the first hunk still reads as the first difference, not `0/2`. */
  assert.deepEqual(hunkAt(changes, 1), { index: 1, total: 2 });
});

test('an unchanged file reports no hunks, and bad input does not throw', () => {
  assert.deepEqual(hunkAt(null, 4), { index: 0, total: 0 });
  assert.deepEqual(hunkAt([], 4), { index: 0, total: 0 });
  assert.deepEqual(hunkAt([{ modifiedStartLineNumber: 1, modifiedEndLineNumber: 2 }], NaN), { index: 0, total: 1 });
});

test('the diff toolbar walks hunks with the buttons and F7', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(body, /diff\.goToDiff\(direction === 'previous' \? 'previous' : 'next'\)/);
  assert.match(body, /diff\.onDidUpdateDiff/);
  assert.match(body, /diff\.revealFirstDiff\(\)/);
  /* Buttons in the header, and a counter that stays out of the way when empty. */
  assert.match(body, /styles\.hunkNav/);
  assert.match(body, /hunks\.total === 0/);
  assert.match(body, /t\('editor\.previousChange'\)/);
  assert.match(body, /t\('editor\.nextChange'\)/);
  /* F7 / ⇧F7 is IDEA's "next / previous difference". */
  assert.match(body, /event\.key !== 'F7'/);
  assert.match(body, /walkHunk\(event\.shiftKey \? 'previous' : 'next'\)/);
});

/* ── Explicit Project reveal owns active-file navigation ─────────────────── */

test('opening tabs never moves the Project tree; explicit reveal does', () => {
  const body = source.slice(source.indexOf('function EditorWorkspace('));
  assert.doesNotMatch(body, /autoScroll/);
  assert.doesNotMatch(body, /void revealInProjectTree\(activePath\)/);
  /* The shared reveal helper must not force the tool window open. */
  const tree = body.slice(body.indexOf('const revealInProjectTree = React.useCallback('), body.indexOf('const revealPath = React.useCallback('));
  assert.doesNotMatch(tree, /setActivity\('project'\)/);
  assert.doesNotMatch(tree, /setPanelVisible\(true\)/);
  /* Explicit "Select in Project View" still does both. */
  const revealStart = body.indexOf('const revealPath = React.useCallback(');
  const reveal = body.slice(revealStart, body.indexOf('const revealActive = React.useCallback(', revealStart));
  assert.match(reveal, /setActivity\('project'\)/);
  assert.match(reveal, /setPanelVisible\(true\)/);
});

test('Project no longer offers an automatic active-tab follow preference', () => {
  assert.doesNotMatch(source, /const toggleAutoScroll = React\.useCallback/);
  assert.doesNotMatch(source, /dsh-editor\.project\.autoscroll'/);
  const options = source.slice(source.indexOf('onOpenOptions: (event) => {'), source.indexOf('onCreateChange: (value) =>'));
  assert.doesNotMatch(options, /id: 'autoscroll'/);
});

/* ── IDEA's in-tree typeahead ───────────────────────────────────────────── */

const tree = [
  { name: 'Work', path: '', kind: 'root' },
  { name: 'src', path: 'src', kind: 'directory' },
  { name: 'graph.ts', path: 'src/graph.ts', kind: 'file' },
  { name: 'grid.ts', path: 'src/grid.ts', kind: 'file' },
  { name: 'index.ts', path: 'src/index.ts', kind: 'file' },
];

test('typeahead jumps to the first prefix match, wrapping around', () => {
  assert.equal(typeaheadMatch(tree, 'gr', null, false), 'src/graph.ts');
  assert.equal(typeaheadMatch(tree, 'g', 'src/graph.ts', true), 'src/grid.ts');
  /* Past the last hit it wraps back to the first, IDEA's behaviour. */
  assert.equal(typeaheadMatch(tree, 'gr', 'src/grid.ts', true), 'src/graph.ts');
});

test('typeahead matches the START of a name only', () => {
  /* IDEA's tree typeahead is prefix-based: `ndex` must not find `index.ts`. */
  assert.equal(typeaheadMatch(tree, 'ndex', null, false), null);
  assert.equal(typeaheadMatch(tree, 'IN', null, false), 'src/index.ts');
});

test('typeahead skips placeholder and unknown rows', () => {
  const rows = [...tree, { name: '', path: '::empty', kind: 'placeholder' }, { path: 'src/broken', kind: 'file' }];
  assert.equal(typeaheadMatch(rows, 'zz', null, false), null);
  assert.equal(typeaheadMatch([], 'a', null, false), null);
  assert.equal(typeaheadMatch(tree, '   ', null, false), null);
});

test('extending a prefix keeps the match instead of skipping past it', () => {
  /* `g` → graph.ts, then `r` must stay on graph.ts. Searching strictly AFTER the
     current row sent `gr` to grid.ts: the user saw the selection jump away from
     the file they were narrowing down. */
  const first = typeaheadStep({ rows: tree, buffer: '', path: null, key: 'g', now: 1000, lastAt: 0 });
  assert.equal(first.hit, 'src/graph.ts');
  const second = typeaheadStep({ rows: tree, buffer: first.buffer, path: first.hit, key: 'r', now: 1100, lastAt: first.at });
  assert.equal(second.buffer, 'gr');
  assert.equal(second.hit, 'src/graph.ts');
});

test('repeating the same letters cycles to the next match', () => {
  const typed = typeaheadStep({ rows: tree, buffer: 'gr', path: 'src/graph.ts', key: 'r', now: 2000, lastAt: 1900 });
  assert.equal(typed.buffer, 'gr');
  assert.equal(typed.hit, 'src/grid.ts');
});

test('a dead-end prefix restarts from the new character', () => {
  /* `g` `x` matches nothing; `r` should still find readme.md, not stay on `gx`. */
  const dead = typeaheadStep({ rows: tree, buffer: 'g', path: 'src/graph.ts', key: 'x', now: 3000, lastAt: 2900 });
  assert.equal(dead.hit, null);
  assert.equal(dead.buffer, '');
  const next = typeaheadStep({ rows: tree, buffer: dead.buffer, path: 'src/graph.ts', key: 'r', now: 3100, lastAt: dead.at });
  assert.equal(next.hit, null, 'no name starts with r in the fixture');
});

test('a pause longer than the reset window starts a new prefix', () => {
  const late = typeaheadStep({ rows: tree, buffer: 'gr', path: 'src/graph.ts', key: 'i', now: 9000, lastAt: 1000 });
  assert.equal(late.buffer, 'i');
  assert.equal(late.hit, 'src/index.ts');
});

test('typing in the tree moves the selection and stays out of form fields', () => {
  const handler = source.slice(source.indexOf('const onTreeKeyDown = React.useCallback('), source.indexOf('const toggleCommitPath = React.useCallback('));
  assert.match(handler, /event\.key\.length === 1 && !event\.metaKey && !event\.ctrlKey && !event\.altKey/);
  assert.match(handler, /const step = typeaheadStep\(\{/);
  /* Unmatched letters fall through to the normal key handling. */
  assert.match(handler, /if \(step\.hit !== null\) \{\n\s+event\.preventDefault\(\);/);
  /* The rename field and create row live inside the tree: without the guard every
     letter would also run the typeahead and never reach the input. */
  assert.match(handler, /event\.target\.closest\('input, textarea, select'\) !== null\) return;/);
  assert.match(source, /const TYPEAHEAD_RESET_MS = \d+;/);
  assert.match(source, /const typeaheadAt = React\.useRef\(0\);/);
  assert.match(source, /const typeaheadBuffer = React\.useRef\(''\);/);
});
