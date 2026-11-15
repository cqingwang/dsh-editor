import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Evaluate one shipping helper by brace balance, so these tests exercise the
 * real function instead of a copy of its logic.
 * @param {string} name - function name at four-space indentation.
 * @returns {Function} the loaded function.
 */
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

/**
 * Load several helpers into ONE scope: `changeTreeOf` sorts through
 * `sortChangeTree`, which a per-function loader cannot see.
 * @param {string[]} names - function names, in dependency order.
 * @returns {object} the functions by name.
 */
function loadAll(names) {
  const bodies = names.map((name) => {
    const marker = `    function ${name}(`;
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
    let index = source.indexOf('{', start);
    let depth = 0;
    for (; index < source.length; index += 1) {
      if (source[index] === '{') depth += 1;
      else if (source[index] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    return source.slice(start, index + 1);
  });
  return new Function(`${bodies.join('\n')}; return { ${names.join(', ')} };`)();
}

const { changeTreeOf, groupingDepth } = loadAll(['sortChangeTree', 'changeTreeOf', 'groupingDepth']);

/** Build a change entry the way the host reports it. */
const change = (path) => ({ path, status: 'M ', stagedLines: undefined, unstagedLines: undefined });

/** Flatten a change tree into `dir/` + `file` markers for easy assertions. */
function shape(node, prefix = '') {
  const out = [];
  for (const child of node.directories.values()) out.push(`${prefix}${child.name}/`, ...shape(child, `${prefix}${child.name}/`));
  for (const file of node.files) out.push(`${prefix}${file.path.slice(prefix.length)}`);
  return out;
}

/* ── Group by: flat / module / directory ───────────────────────────────── */

test('the three modes are nesting depths, not three code paths', () => {
  /* IDEA's dropdown only changes how deep the same tree nests, so one renderer
     and one set of collapse keys serve all three. */
  assert.equal(groupingDepth('flat'), 0);
  assert.equal(groupingDepth('module'), 1);
  assert.equal(groupingDepth('directory'), Infinity);
  /* An unknown mode must not flatten the list by accident. */
  assert.equal(groupingDepth('nonsense'), Infinity);
});

test('flat mode produces no directory nodes', () => {
  const tree = changeTreeOf([change('a/b/c.ts'), change('a/d.ts'), change('e.ts')], groupingDepth('flat'));
  assert.equal(tree.directories.size, 0);
  assert.equal(tree.files.length, 3);
});

test('module mode groups by the FIRST path segment only', () => {
  const tree = changeTreeOf([change('a/b/c.ts'), change('a/d.ts'), change('e.ts')], groupingDepth('module'));
  assert.deepEqual([...tree.directories.keys()], ['a']);
  const a = tree.directories.get('a');
  /* Everything below the module stays flat in that group. */
  assert.equal(a.directories.size, 0);
  assert.deepEqual(a.files.map((file) => file.path), ['a/b/c.ts', 'a/d.ts']);
  assert.deepEqual(tree.files.map((file) => file.path), ['e.ts']);
});

test('directory mode nests the whole path', () => {
  const tree = changeTreeOf([change('a/b/c.ts'), change('a/d.ts'), change('e.ts')], groupingDepth('directory'));
  assert.deepEqual(shape(tree), ['a/', 'a/b/', 'a/b/c.ts', 'a/d.ts', 'e.ts']);
});

test('a path with no directory still lands in the group', () => {
  const tree = changeTreeOf([change('e.ts')], groupingDepth('directory'));
  assert.equal(tree.directories.size, 0);
  assert.deepEqual(tree.files.map((file) => file.path), ['e.ts']);
});

/* ── the menu and the preference ──────────────────────────────────────── */

test('the Group by menu offers all three modes and marks the current one', () => {
  const block = source.slice(source.indexOf('const changeGroupMenu = React.useCallback('), source.indexOf("/* IDEA's \"Move to…\" picker for the current tree selection."));
  assert.match(block, /\['flat', 'module', 'directory'\]\.map/);
  /* A check mark, not a disabled row: the popup has to say where you ARE. */
  assert.match(block, /shortcut: groupBy === mode \? '✓' : ''/);
  assert.match(block, /run: \(\) => applyChangeGroupBy\(mode\)/);
  const apply = source.slice(
    source.indexOf('const applyChangeGroupBy = React.useCallback('),
    source.indexOf('const changeGroupMenu = React.useCallback('),
  );
  assert.match(apply, /window\.localStorage\.setItem\('dsh-editor\.commit\.groupBy', mode\)/);
});

test('the choice is persisted and restored', () => {
  assert.match(source, /readStoredText\('dsh-editor\.commit\.groupBy', 'directory'\)/);
  /* The renderer reads the mode through the depth helper, never a second tree. */
  assert.match(source, /changeTreeOf\(group\.changes, groupingDepth\(groupBy\)\)/);
  /* Commit Options carries the same value menu, including its current check mark. */
  const menu = source.slice(source.indexOf('const openCommitOptionsMenu = React.useCallback('), source.indexOf('const commit = React.useCallback(', source.indexOf('const openCommitOptionsMenu = React.useCallback(')));
  assert.match(menu, /label: t\('editor\.groupByMenu'\),\s+items: groupMenu\.items/);
});

test('both dictionaries define every grouping key exactly once', () => {
  /* Round 114 hit a duplicate-key bug in this same area; adding the English
     block with a blind replace put it in the Chinese dictionary too. */
  for (const key of ['groupByMode', 'groupBy_flat', 'groupBy_module', 'groupBy_directory', 'groupByMenu']) {
    const occurrences = source.match(new RegExp(`^        ${key}:`, 'gmu')) ?? [];
    assert.equal(occurrences.length, 2, `${key} must appear once per dictionary, saw ${occurrences.length}`);
  }
});

/* ── terminal find bar keys ────────────────────────────────────────────── */

test('⌘G and ⇧⌘G walk the terminal find matches', () => {
  /* The bar had buttons only, so the keyboard path stopped at the counter —
     measured before the fix: `1/2` and ⌘G left it at `1/2`. */
  const block = source.slice(source.indexOf("event.key.toLowerCase() === 'g'"), source.indexOf('/* ⌘A selects the whole buffer'));
  assert.match(block, /const current = findRef\.current;/);
  assert.match(block, /moveTerminalSelection\(emulator, current, setFind, event\.shiftKey \? -1 : 1\)/);
  /* With no find bar open the key belongs to whatever else wanted it. */
  assert.match(block, /if \(current === null \|\| emulator === null \|\| emulator === undefined\) return;/);
});
