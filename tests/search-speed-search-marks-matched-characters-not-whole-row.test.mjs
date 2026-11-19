import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/project/FileTreeView.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping function by brace balance. */
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

const highlightParts = load('highlightParts');

test('speed search marks the matched characters, not the whole row', () => {
  /* IDEA highlights the matching substring inside the label; a whole-row tint
     would make a long path unreadable. */
  const parts = highlightParts('index.spec.ts', 'spec');
  assert.deepEqual(parts, [
    { text: 'index.', match: false },
    { text: 'spec', match: true },
    { text: '.ts', match: false },
  ]);
});

test('the match is case-insensitive but the original text survives', () => {
  const parts = highlightParts('README.md', 'read');
  assert.deepEqual(parts, [
    { text: 'READ', match: true },
    { text: 'ME.md', match: false },
  ]);
  /* Everything after the first hit keeps the original casing. */
  assert.equal(parts.map((part) => part.text).join(''), 'README.md');
});

test('every occurrence is marked, and a miss or empty query yields one plain part', () => {
  const twice = highlightParts('a/a.ts', 'a');
  assert.deepEqual(
    twice.filter((part) => part.match).map((part) => part.text),
    ['a', 'a'],
  );
  assert.deepEqual(highlightParts('notes.md', 'zzz'), [{ text: 'notes.md', match: false }]);
  assert.deepEqual(highlightParts('notes.md', ''), [{ text: 'notes.md', match: false }]);
  assert.deepEqual(highlightParts('', 'x'), []);
});

test('the tree row renders the highlight spans while filtering', () => {
  const start = source.indexOf('<EntryIcon');
  assert.notEqual(start, -1);
  assert.match(source, /highlightParts\(row\.name, search\)/);
  assert.match(source, /style=\{styles\.treeNameMatch\}/);
});
