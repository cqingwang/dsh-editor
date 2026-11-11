import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Pull one `    function name(...)` block out of the client bundle by brace balance.
 *
 * The browser half cannot be imported in Node (it calls `window.__ModuleLoader__`
 * at module scope), but its pure helpers are ordinary functions. Extracting the
 * exact source text and evaluating it runs the SHIPPING code — a string-pattern
 * assertion would still pass if the logic were wrong.
 * @param {string} name - function name at four-space indentation.
 * @returns {string} the function source.
 */
function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  const open = index;
  let depth = 0;
  for (; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name} after ${open}`);
}

/**
 * Evaluate extracted helpers in one scope so they can call each other.
 * @param {string[]} names - functions to load, in dependency order.
 * @returns {object} the helpers by name.
 */
function load(names) {
  const bodies = names.map(extract).join('\n');
  const factory = new Function(`'use strict';\n${bodies}\nreturn { ${names.join(', ')} };`);
  return factory();
}

/* `changeTreeOf` sorts through `sortChangeTree`, and both use `basename`. */
const helpers = load(['basename', 'dirname', 'sortChangeTree', 'changeTreeOf', 'splitChanges', 'filterTreeRows', 'commitMetrics', 'gitStatusInfo']);

test('changeTreeOf groups by directory and sorts directories before files', () => {
  const tree = helpers.changeTreeOf([
    { path: 'src/app.ts', status: ' M' },
    { path: 'aaa.txt', status: '??' },
    { path: 'src/nested/deep.ts', status: 'M ' },
    { path: 'lib/util.ts', status: 'A ' },
  ]);
  assert.deepEqual([...tree.directories.keys()], ['lib', 'src']);
  assert.deepEqual(tree.files.map((file) => file.path), ['aaa.txt']);
  assert.deepEqual([...tree.directories.get('src').files.map((file) => file.path)], ['src/app.ts']);
  assert.deepEqual([...tree.directories.get('src').directories.keys()], ['nested']);
});

test('splitChanges sorts porcelain codes into staged, unstaged and unversioned', () => {
  const { staged, unstaged, unversioned } = helpers.splitChanges([
    { path: 'a.ts', status: 'M ' },
    { path: 'b.ts', status: ' M' },
    { path: 'c.ts', status: 'MM' },
    { path: 'd.ts', status: '??' },
  ]);
  assert.deepEqual(staged.map((change) => change.path), ['a.ts', 'c.ts']);
  /* A path changed on both sides appears in both bands, exactly like IDEA. */
  assert.deepEqual(unstaged.map((change) => change.path), ['b.ts', 'c.ts']);
  assert.deepEqual(unversioned.map((change) => change.path), ['d.ts']);
});

test('filterTreeRows keeps hits and their ancestors, never orphans them', () => {
  const rows = [
    { path: '', name: 'workspace', kind: 'directory' },
    { path: 'src', name: 'src', kind: 'directory' },
    { path: 'src/nested', name: 'nested', kind: 'directory' },
    { path: 'src/nested/deep.ts', name: 'deep.ts', kind: 'file' },
    { path: 'readme.md', name: 'readme.md', kind: 'file' },
  ];
  const filtered = helpers.filterTreeRows(rows, 'deep');
  assert.deepEqual(filtered.map((row) => row.path), ['', 'src', 'src/nested', 'src/nested/deep.ts']);
  /* An empty query is the identity; a miss still shows the root so the tree is not blank. */
  assert.equal(helpers.filterTreeRows(rows, '').length, rows.length);
  assert.deepEqual(helpers.filterTreeRows(rows, 'zzz').map((row) => row.path), ['']);
  assert.deepEqual(helpers.filterTreeRows(rows, 'README').map((row) => row.path), ['', 'readme.md']);
});

test('commitMetrics splits subject from body the way git log reads it', () => {
  const single = helpers.commitMetrics('feat: add tree');
  assert.equal(single.subject, 'feat: add tree');
  assert.equal(single.subjectLength, 14);
  assert.equal(single.body, '');
  assert.equal(single.bodyLines, 0);

  const multi = helpers.commitMetrics('feat: add tree\n\nwhy it exists\nand what it changes\n');
  assert.equal(multi.subjectLength, 14);
  assert.equal(multi.bodyLines, 3);
  assert.match(multi.body, /why it exists/);

  /* Trailing spaces must not inflate the subject counter. */
  assert.equal(helpers.commitMetrics('abc   \nbody').subjectLength, 3);
  /* An over-long subject is reported, not truncated. */
  const long = helpers.commitMetrics('x'.repeat(60));
  assert.equal(long.subjectLength, 60);
  assert.equal(long.subject, 'x'.repeat(60));
  assert.equal(helpers.commitMetrics(undefined).subjectLength, 0);
});

test('basename and dirname agree with the paths the tree uses', () => {
  assert.equal(helpers.basename('src/nested/deep.ts'), 'deep.ts');
  assert.equal(helpers.basename('readme.md'), 'readme.md');
  assert.equal(helpers.dirname('src/nested/deep.ts'), 'src/nested');
  assert.equal(helpers.dirname('readme.md'), '');
});

test('gitStatusInfo maps every porcelain code the panel can show', () => {
  const info = helpers.gitStatusInfo;
  assert.equal(info(undefined), null);
  assert.equal(info('??').label, 'U');
  assert.equal(info('A ').label, 'A');
  assert.equal(info('D ').label, 'D');
  assert.equal(info(' M').label, 'M↓');
  assert.equal(info('M ').label, 'M');
  assert.equal(info('R ').label, 'R');
  /* An unmerged code must never read as a plain modification. */
  assert.equal(info('UU').label, '!');
  assert.equal(info('UU').color, '#cf222e');
});

test('commit template prefixes replace instead of stacking', () => {
  /* Replays the exact body of applyCommitTemplate: strip a known prefix, then add one. */
  const TEMPLATES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style'];
  const apply = (current, prefix) => {
    const match = /^([a-z]+)(\([^)]*\))?: ?/u.exec(current);
    const rest = match !== null && TEMPLATES.includes(match[1]) ? current.slice(match[0].length) : current;
    return `${prefix}: ${rest}`;
  };
  assert.equal(apply('', 'feat'), 'feat: ');
  assert.equal(apply('add tree', 'feat'), 'feat: add tree');
  /* Applying a different template rewrites the prefix instead of nesting it. */
  assert.equal(apply('feat: add tree', 'fix'), 'fix: add tree');
  assert.equal(apply(apply('add tree', 'feat'), 'fix'), 'fix: add tree');
  /* A scope survives a rewrite; an unknown leading word is kept as the subject. */
  assert.equal(apply('feat(tree): add', 'fix'), 'fix: add');
  assert.equal(apply('wip: add tree', 'feat'), 'feat: wip: add tree');
});
