import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const logMenuSource = readFileSync(join(root, 'src/client/components/commit/log-menu.ts'), 'utf8');
const source = [
  logMenuSource,
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');
const menu = transpileTypeScriptFunction(logMenuSource, 'commitLogMenu');

test('the log row menu offers "copy subject" next to "copy hash"', () => {
  /* Copying the hash is for a terminal; copying the subject is for a chat, a PR
     description or a changelog. IDEA's log menu has both. */
  const start = menu.indexOf('function commitLogMenu(');
  assert.notEqual(start, -1);
  const block = menu;
  assert.match(block, /t\('editor\.copySubject'\)/);
  assert.match(block, /onCopyText\(commit\.subject \?\? ''\)/);
  /* The two copy items stay adjacent, separated from the history actions. */
  assert.match(block, /t\('editor\.copyHash'\)/);
});

test('a missing subject disables the item instead of copying "undefined"', () => {
  const block = menu;
  assert.match(block, /disabled: typeof commit\.subject !== 'string' \|\| commit\.subject === ''/);
});

test('both dictionaries carry the label', () => {
  assert.equal(source.split('copySubject:').length - 1, 2);
});
