import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/commit/CommitLogToolbar.tsx'), 'utf8');

function commitLog() {
  return source;
}

test('closing the Log search clears its invisible query', () => {
  const log = commitLog();
  const action = log.slice(log.indexOf('const toggleFilter = () => {'), log.indexOf('return (', log.indexOf('const toggleFilter = () => {')));
  assert.match(action, /const next = commitLogFilterToggle\(filterVisible\)/);
  assert.match(action, /onFilterVisibleChange\(next\.visible\)/);
  assert.match(action, /if \(next\.focusInput\)/);
  assert.match(action, /else if \(next\.clearFilter\) \{[\s\S]*?onFilterChange\(''\);/);
});

test('Escape and toolbar close share the same clear-and-hide state', () => {
  const log = commitLog();
  assert.match(log, /if \(event\.key === 'Escape'\) \{[\s\S]*?onFilterChange\(''\);[\s\S]*?onFilterVisibleChange\(false\);/);
});
