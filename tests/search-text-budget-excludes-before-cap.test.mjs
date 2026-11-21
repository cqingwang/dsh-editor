import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const SENTINEL = 'SEARCH_BUDGET_ONLY_VISIBLE_NEEDLE';

test('file masks filter text-search candidates before the file budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-mask-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (let index = 0; index < 2001; index += 1) {
    await writeFile(join(root, `noise-${String(index).padStart(4, '0')}.txt`), 'other\n', 'utf8');
  }
  await writeFile(join(root, 'zz-visible.ts'), `${SENTINEL}\n`, 'utf8');

  const result = await host.searchWorkspaceText(root, SENTINEL, {
    fileMask: '*.ts',
    maxMatches: 20,
  });

  assert.deepEqual(result.matches.map((match) => match.path), ['zz-visible.ts']);
  assert.equal(result.truncated, false);
});

test('Git ignored tracked files do not consume the text-search file budget', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-text-git-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-dir/\n', 'utf8');
  await mkdir(join(root, 'ignored-dir'));
  for (let index = 0; index < 5001; index += 1) {
    await writeFile(
      join(root, 'ignored-dir', `noise-${String(index).padStart(4, '0')}.txt`),
      'other\n',
      'utf8',
    );
  }
  await writeFile(join(root, 'zz-visible.txt'), `${SENTINEL}\n`, 'utf8');
  await execFileAsync('git', ['-C', root, 'add', '.gitignore', 'zz-visible.txt']);
  await execFileAsync('git', ['-C', root, 'add', '-f', 'ignored-dir']);

  const result = await host.searchWorkspaceText(root, SENTINEL, {
    gitScope: 'tracked',
    maxMatches: 20,
  });

  assert.deepEqual(result.matches.map((match) => match.path), ['zz-visible.txt']);
  assert.equal(result.truncated, false);
});
