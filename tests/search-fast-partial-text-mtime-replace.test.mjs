import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { replaceWorkspaceText, searchWorkspaceText } from '../lib/index.js';

test('fast partial text search returns a real mtime that Replace can validate', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-fast-partial-mtime-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  const path = join(root, 'probe.ts');
  await writeFile(path, 'export const FAST_PARTIAL_NEEDLE = true;\n', 'utf8');

  const result = await searchWorkspaceText(root, 'FAST_PARTIAL_NEEDLE', {
    fastPartialTextSearch: true,
    maxMatches: 20,
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
  });
  assert.equal(result.fastPartialTextSearch, true);
  assert.equal(result.matches.length, 1);
  const match = result.matches[0];
  const info = await stat(path);
  assert.equal(match.path, 'probe.ts');
  assert.ok(match.mtime > 0);
  assert.ok(Math.abs(match.mtime - info.mtimeMs) <= 1);

  const replaced = await replaceWorkspaceText(
    root,
    'FAST_PARTIAL_NEEDLE',
    'FAST_PARTIAL_REPLACED',
    [{ path: match.path, mtime: match.mtime }],
    {},
  );
  assert.equal(replaced.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'export const FAST_PARTIAL_REPLACED = true;\n');
});
