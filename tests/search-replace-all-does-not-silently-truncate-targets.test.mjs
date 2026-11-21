import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const host = await import('../lib/index.js');

test('Replace All updates every selected target instead of silently stopping at 200', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-replace-targets-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = [];
  for (let index = 0; index < 201; index += 1) {
    const path = `file-${String(index).padStart(3, '0')}.txt`;
    paths.push(path);
    await writeFile(join(root, path), 'replace-target-needle\n', 'utf8');
  }
  const targets = await Promise.all(
    paths.map(async (path) => ({ path, mtime: (await stat(join(root, path))).mtimeMs })),
  );

  const summary = await host.replaceWorkspaceText(root, 'replace-target-needle', 'replaced', targets);

  assert.equal(summary.changedFiles, 201);
  assert.equal(summary.replacements, 201);
  assert.equal(summary.files.length, 201);
  for (const path of paths) {
    assert.equal(await readFile(join(root, path), 'utf8'), 'replaced\n');
  }
});

test('Replace All rejects an oversized target list instead of truncating it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-replace-target-limit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const targets = Array.from({ length: 501 }, (_, index) => ({
    path: `missing-${String(index).padStart(3, '0')}.txt`,
    mtime: 0,
  }));

  await assert.rejects(
    host.replaceWorkspaceText(root, 'needle', 'replaced', targets),
    /Replace All supports at most 500 files/u,
  );
});
