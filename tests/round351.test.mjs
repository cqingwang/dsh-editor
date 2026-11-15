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

test('flat Log opens the existing commit menu from the keyboard', () => {
  const log = commitLog();
  assert.match(log, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
  assert.match(log, /flatLogTarget\(visible, selected, 'current'\)/);
  assert.match(log, /data-dsh-log-hash/);
  assert.match(log, /onContextMenu\?\.\(\{\s+commit: target,\s+x:/);
  assert.match(log, /getBoundingClientRect/);
});

test('flat Log rows expose their hash and popup semantics', () => {
  const log = commitLog();
  assert.match(log, /'data-dsh-log-hash': commit\.hash/);
  assert.match(log, /'aria-haspopup': 'menu'/);
});
