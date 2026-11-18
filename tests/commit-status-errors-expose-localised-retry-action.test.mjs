import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

test('Commit status errors expose a localised retry action', () => {
  const panelStart = source.indexOf('function CommitPanel({');
  const panelEnd = source.indexOf('function CommitLogView(', panelStart);
  assert.notEqual(panelStart, -1);
  assert.notEqual(panelEnd, -1);
  const panel = source.slice(panelStart, panelEnd);
  assert.match(panel, /onRetryStatus,/);
  assert.match(panel, /error !== null[\s\S]*?onRetryStatus === undefined[\s\S]*?onRetryStatus\?\.\(\)[\s\S]*?t\('editor\.logRetry'\)/);
  assert.match(source, /onRetryStatus: \(\) => void loadGit\(\)/);
});
