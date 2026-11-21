import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');

test('system-generated files do not consume the Project speed-search traversal budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-speed-search-system-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, '.DS_Store'), 'cache\n', 'utf8');
  await writeFile(join(root, 'system-budget-needle.txt'), 'match\n', 'utf8');

  const result = await host.workspaceFileOperations.search(root, 'system-budget-needle', {
    showHidden: true,
    showExcluded: true,
    maxVisited: 1,
  });

  assert.deepEqual(result.entries.map((entry) => entry.path), ['system-budget-needle.txt']);
  assert.equal(result.truncated, false);
});
