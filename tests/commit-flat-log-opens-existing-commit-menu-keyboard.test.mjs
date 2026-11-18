import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8')) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

function commitLog() {
  return source.slice(source.indexOf('function CommitLogView('), source.indexOf('const CommitLog = CommitLogView;'));
}

test('flat Log opens the existing commit menu from the keyboard', () => {
  const log = commitLog();
  assert.match(log, /commitLogFlatKeyIntent\(/);
  assert.match(log, /flatLogTarget\(visible, selected, 'current'\)/);
  assert.match(log, /data-dsh-log-hash/);
  assert.match(log, /onContextMenu\?\.\(\{\s+commit: target,\s+selectionHashes: contextSelectionFor\(target\.hash\),\s+x:/);
  assert.match(log, /querySelector\?\.\(`\[data-dsh-log-hash=/);
});

test('flat Log rows expose their hash and popup semantics', () => {
  const row = readFileSync(join(root, 'src/client/components/commit/CommitLogFlatRow.tsx'), 'utf8');
  assert.match(row, /data-dsh-log-hash=\{commit\.hash\}/);
  assert.match(row, /aria-haspopup='menu'/);
});
