import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the tree and the terminal tab do not both say "copy absolute path"', () => {
  /* The terminal tab copies a directory, the tree copies a file: two items with the
     same label in two menus is a coin flip for the user. The terminal one names the
     noun it copies. */
  /* The tree's copyPath label must not claim the terminal's "directory" noun or
     the old ambiguous "absolute path" wording. */
  const lines = source.split('\n').filter((line) => /^        copyPath: '/.test(line));
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => !/绝对|absolute/i.test(line)));
  const renamed = source.split('\n').filter((line) => /^        copyDirectoryPath: '/.test(line));
  assert.equal(renamed.length, 2, 'zh and en must both define the directory wording');
});

test('both dictionaries agree on the terminal wording', () => {
  const zh = /copyDirectoryPath: '([^']+)'/.exec(source);
  const en = /copyDirectoryPath: '([^']+)'/.exec(source.slice(source.indexOf('const en = {')));
  assert.notEqual(zh, null);
  assert.notEqual(en, null);
  assert.match(zh[1], /目录/);
  assert.match(en[1], /directory/i);
});
