import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = host.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = host.indexOf('{', host.indexOf('(', start));
  let depth = 0;
  for (let index = bodyStart; index < host.length; index += 1) {
    if (host[index] === '{') depth += 1;
    if (host[index] === '}') {
      depth -= 1;
      if (depth === 0) return host.slice(start, index + 1);
    }
  }
  assert.fail(`${name} has no closing brace`);
}

test('suspended clear/rebuild mutations reject stale queued writes', async () => {
  const writes = [];
  const writesByWorkspace = new Map();
  const suspended = new Set(['workspace']);
  const generations = new Map([['workspace', 2]]);
  const progress = new Map();
  const queueWrite = new Function(
    'SEARCH_INDEX_WRITES',
    'SEARCH_INDEX_SUSPENDED',
    'SEARCH_INDEX_REBUILD_PROGRESS',
    'SEARCH_INDEX_GENERATIONS',
    'writeWorkspaceSearchIndex',
    `${extractFunction('queueWorkspaceSearchIndexWrite')}\nreturn queueWorkspaceSearchIndexWrite;`,
  )(writesByWorkspace, suspended, progress, generations, async (identity) => writes.push(identity.key));
  const identity = { key: 'workspace' };
  const index = { dirty: true, dirtyRevision: 1 };

  assert.equal(await queueWrite(identity, index, 2), false);
  assert.deepEqual(writes, []);
  assert.equal(index.dirty, true);

  suspended.clear();
  assert.equal(await queueWrite(identity, index, 2), true);
  assert.deepEqual(writes, ['workspace']);
  assert.equal(index.dirty, false);
});
