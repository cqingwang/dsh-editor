import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const terminalSource = readFileSync(join(root, 'src/client/terminal.ts'), 'utf8');
const editorCoreSource = readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');
const planMoves = new Function(
  `${transpileTypeScriptFunction(editorCoreSource, 'basename')}\n${transpileTypeScriptFunction(terminalSource, 'planMoves')}\nreturn planMoves;`,
)();

test('a batch move maps every source into the target directory', () => {
  const plan = planMoves(['a.txt', 'docs/b.txt'], 'lib', new Set(['a.txt', 'docs/b.txt', 'lib']));
  assert.deepEqual(plan.moves, [
    { from: 'a.txt', to: 'lib/a.txt' },
    { from: 'docs/b.txt', to: 'lib/b.txt' },
  ]);
  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.intoSelf, []);
  assert.deepEqual(plan.unchanged, []);
});

test('a destination that already exists is reported before anything moves', () => {
  /* The old loop discovered this on the second rename, after the first had
     already changed the tree — a half-applied drag. */
  const plan = planMoves(['a.txt', 'b.txt'], 'lib', new Set(['lib/b.txt', 'lib']));
  assert.deepEqual(plan.conflicts, [{ from: 'b.txt', to: 'lib/b.txt', reason: 'exists' }]);
  assert.deepEqual(plan.moves.map((move) => move.from), ['a.txt']);
});

test('two sources with the same basename collide with each other', () => {
  const plan = planMoves(['one/x.ts', 'two/x.ts'], 'lib', new Set(['lib']));
  assert.equal(plan.moves.length, 1);
  assert.deepEqual(plan.conflicts, [{ from: 'two/x.ts', to: 'lib/x.ts', reason: 'duplicate' }]);
});

test('a directory cannot move into itself or below itself', () => {
  const plan = planMoves(['src', 'src/nested'], 'src', new Set(['src']));
  assert.deepEqual(plan.intoSelf, ['src']);
  /* `src/nested` already lives in `src`: dropping it there is a no-op, not a move. */
  assert.deepEqual(plan.unchanged, ['src/nested']);
  assert.deepEqual(plan.moves, []);
  /* Dropping onto the directory a file already lives in is a no-op, not an error. */
  const same = planMoves(['src/a.ts'], 'src', new Set(['src', 'src/a.ts']));
  assert.deepEqual(same.unchanged, ['src/a.ts']);
  assert.deepEqual(same.moves, []);
  assert.deepEqual(same.conflicts, []);
});

test('empty and duplicate sources are dropped', () => {
  const plan = planMoves(['', 'a.txt', 'a.txt'], '', new Set(['a.txt']));
  /* The workspace root is not a destination a row can be dropped onto, but the
     planner stays total: '' means "target directory is the root". */
  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.unchanged, ['a.txt']);
});

test('the drop handler plans first and only then calls rename', () => {
  const start = source.indexOf('const moveEntry =');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('/* Resolve one conflicted file', start));
  /* One plan call covering the whole selection… */
  assert.match(block, /const plan = planMoves\(/);
  /* …and the conflict path names the destination, IDEA's "already exists" wording. */
  assert.match(block, /plan\.conflicts\[0\]/);
  assert.match(block, /for \(const move of plan\.moves\)/);
});

test('the plan asks the host about collapsed destinations instead of guessing', () => {
  const start = source.indexOf('const moveEntry =');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('/* Resolve one conflicted file', start));
  /* `rows` only holds what is expanded; a collapsed directory's child must be
     checked on disk or the drag would overwrite it. */
  assert.match(block, /op: 'exists', paths: candidate/);
  assert.match(block, /const existing = new Set\(\[\.\.\.rows\.map\(\(row\) => row\.path\), \.\.\.taken\]\);/);
});
