import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('Commit Log double-click uses the same EditSource semantics as F4', () => {
  const log = source.slice(source.indexOf('function CommitLog('), source.indexOf('/* COMMIT_LOG_BOUNDARY */'));
  assert.match(log, /onDoubleClick: \(\) => \{[\s\S]*?if \(localExists\) onEditSource\?\.\(file\.path\);/);
});
