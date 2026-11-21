import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');

test('an unreadable Git ignore index fails search instead of leaking ignored files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-gitignore-read-failure-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await mkdir(join(root, 'ignored'));
  await writeFile(join(root, '.gitignore'), 'ignored/\n', 'utf8');
  await writeFile(join(root, 'ignored', 'hidden.txt'), 'IGNORE_FAILURE_NEEDLE hidden\n', 'utf8');
  await writeFile(join(root, 'visible.txt'), 'IGNORE_FAILURE_NEEDLE visible\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'add', '.gitignore', 'visible.txt']);
  await writeFile(join(root, '.git', 'index'), 'corrupt index\n', 'utf8');

  await assert.rejects(
    host.searchWorkspaceText(root, 'IGNORE_FAILURE_NEEDLE', {
      includeExcluded: true,
      maxMatches: 20,
    }),
    /index file smaller than expected|index file corrupt|fatal/iu,
  );
  await assert.rejects(
    host.workspaceFileOperations.files(root, 100, {
      includeExcluded: true,
      respectGitIgnore: true,
    }),
    /index file smaller than expected|index file corrupt|fatal/iu,
  );
});
