import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

test('group selection can be cleared when filtering removes every visible row', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  assert.match(panel, /if \(filteredTargets\.length === 0\) \{[\s\S]*?onSelectGroup\?\.\(null\)/);
});

test('chooseGroup accepts null as an explicit clear operation', () => {
  const start = source.indexOf('const chooseGroup = React.useCallback(');
  const block = source.slice(start, source.indexOf('}, []);', start) + 8);
  assert.match(block, /if \(group !== null && group !== 'staged'/);
});
