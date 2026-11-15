import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitLog() {
  return source.slice(source.indexOf('function CommitLog('), source.indexOf('function formatCommitDate('));
}

test('closing the Log search clears its invisible query', () => {
  const log = commitLog();
  const action = log.slice(log.indexOf("label: t('editor.logFilter')"), log.indexOf('React.createElement(ToolbarButton', log.indexOf("label: t('editor.logFilter')") + 1));
  assert.match(action, /const next = !showFilter/);
  assert.match(action, /setShowFilter\(next\)/);
  assert.match(action, /if \(next\)/);
  assert.match(action, /else \{[\s\S]*?setFilter\(''\);/);
});

test('Escape and toolbar close share the same clear-and-hide state', () => {
  const log = commitLog();
  assert.match(log, /if \(event\.key === 'Escape'\) \{[\s\S]*?setFilter\(''\);[\s\S]*?setShowFilter\(false\);/);
});
