import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  rebuildWorkspaceSearchIndex,
  searchWorkspaceText,
  workspaceSearchIndexStatus,
} from '../lib/index.js';

test('streamed index parsing preserves multibyte text across chunks', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-index-utf8-'));
  const indexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-index-utf8-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(indexDirectory, { recursive: true, force: true }));
  const relativePath = '多字节目录/缓存说明.txt';
  const content = `${'中文缓存数据'.repeat(50_000)}\nSTREAM多字节末尾关键字\n`;
  await mkdir(join(root, '多字节目录'), { recursive: true });
  await writeFile(join(root, relativePath), content, 'utf8');

  const rebuilt = await rebuildWorkspaceSearchIndex(root, { searchIndexDirectory: indexDirectory });
  assert.equal(rebuilt.files, 1);
  const status = await workspaceSearchIndexStatus(root, { searchIndexDirectory: indexDirectory });
  assert.equal(status.files, 1);

  const searched = await searchWorkspaceText(root, 'STREAM多字节末尾关键字', {
    maxMatches: 10,
    searchIndex: true,
    searchIndexDirectory: indexDirectory,
  });
  assert.deepEqual(
    searched.matches.map((match) => match.path),
    [relativePath],
  );
  assert.equal(searched.indexCache.hits, 1);
  assert.equal(searched.indexCache.misses, 0);
});
