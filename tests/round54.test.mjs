import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('a file-history filter can be left for the whole log in one click', () => {
  /* The chip used to offer only "×", which silently threw the filter away; IDEA's
     Log tab has an explicit "show all" action next to the filter it is applying. */
  const start = source.indexOf('historyPath === null');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1600);
  assert.match(block, /t\('editor\.historyShowAll'\)/);
  assert.match(block, /onClick: \(\) => onClearHistory\?\.\(\)/);
  /* The chip names the file it is filtering by, not just "file history". */
  assert.match(block, /basename\(historyPath\)/);
});

test('leaving the filter reloads the unfiltered first page', () => {
  const start = source.indexOf('const clearFileHistory = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 400);
  assert.match(block, /setHistoryPath\(null\);/);
  assert.match(block, /void loadLog\(\);/);
  /* A stale "exhausted" flag would stop the scroll from loading more of the full log. */
  assert.match(source, /const loadLog = React.useCallback\(async \(\) => \{[\s\S]*?setLogExhausted\(firstPage\.length < LOG_PAGE\);/);
});

test('both dictionaries carry the label', () => {
  const hits = source.split('historyShowAll:').length - 1;
  assert.ok(hits >= 2, `historyShowAll must exist twice, found ${hits}`);
});
