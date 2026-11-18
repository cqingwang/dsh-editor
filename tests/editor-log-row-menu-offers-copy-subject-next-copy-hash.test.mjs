import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the log row menu offers "copy subject" next to "copy hash"', () => {
  /* Copying the hash is for a terminal; copying the subject is for a chat, a PR
     description or a changelog. IDEA's log menu has both. */
  const start = source.indexOf('const buildLogMenu = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('/* Rollback discards edits', start));
  assert.match(block, /t\('editor\.copySubject'\)/);
  assert.match(block, /navigator\.clipboard\?\.writeText\(commit\.subject\)/);
  /* The two copy items stay adjacent, separated from the history actions. */
  assert.match(block, /t\('editor\.copyHash'\)/);
});

test('a missing subject disables the item instead of copying "undefined"', () => {
  const start = source.indexOf('const buildLogMenu = React.useCallback(');
  const block = source.slice(start, source.indexOf('/* Rollback discards edits', start));
  assert.match(block, /disabled: typeof commit\.subject !== 'string' \|\| commit\.subject === ''/);
});

test('both dictionaries carry the label', () => {
  assert.equal(source.split('copySubject:').length - 1, 2);
});
