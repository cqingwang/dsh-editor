import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');

test('text search does not report truncation when the exact cap exhausts the only file', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-cap-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'matches.txt'), Array.from({ length: 20 }, () => 'needle').join('\n'), 'utf8');

  const result = await host.searchWorkspaceText(root, 'needle', { maxMatches: 20 });
  assert.equal(result.matches.length, 20);
  assert.equal(result.truncated, false);
});

test('text search remains conservative when unprocessed files can still contain matches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-cap-more-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'a.txt'), Array.from({ length: 20 }, () => 'needle').join('\n'), 'utf8');
  await writeFile(join(root, 'b.txt'), 'needle\n', 'utf8');

  const result = await host.searchWorkspaceText(root, 'needle', { maxMatches: 20 });
  assert.equal(result.matches.length, 20);
  assert.equal(result.truncated, true);
});

test('path filters do not create a false truncation signal', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-cap-mask-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'matches.txt'), Array.from({ length: 20 }, () => 'needle').join('\n'), 'utf8');
  await writeFile(join(root, 'excluded.md'), 'needle\n', 'utf8');

  const result = await host.searchWorkspaceText(root, 'needle', {
    maxMatches: 20,
    fileMask: '*.txt',
  });
  assert.equal(result.matches.length, 20);
  assert.equal(result.truncated, false);
});
