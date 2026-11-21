import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const IGNORED_FILE_COUNT = 2005;
const SENTINEL = 'IGNORE_CAP_NEEDLE';

test('Git ignore filtering stays complete beyond 2000 individually ignored files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-gitignore-overflow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const ignoredNames = Array.from(
    { length: IGNORED_FILE_COUNT },
    (_, index) => `ignored-${String(index).padStart(4, '0')}.tmp`,
  );
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), `${ignoredNames.join('\n')}\n`, 'utf8');
  await writeFile(join(root, 'visible.txt'), `${SENTINEL} visible\n`, 'utf8');
  for (const [index, name] of ignoredNames.entries()) {
    await writeFile(
      join(root, name),
      index === ignoredNames.length - 1 ? `${SENTINEL} hidden\n` : 'ignored\n',
      'utf8',
    );
  }
  await execFileAsync('git', ['-C', root, 'add', '.gitignore', 'visible.txt']);

  const files = await host.workspaceFileOperations.files(root, 5000, {
    includeExcluded: true,
    respectGitIgnore: true,
  });
  assert.ok(files.files.includes('visible.txt'));
  assert.ok(!files.files.some((path) => ignoredNames.includes(path)));

  const text = await host.searchWorkspaceText(root, SENTINEL, {
    includeExcluded: true,
    maxMatches: 20,
  });
  assert.deepEqual(text.matches.map((match) => match.path), ['visible.txt']);

  const speedSearch = await host.workspaceFileOperations.search(root, ignoredNames.at(-1), {
    showHidden: true,
    showExcluded: true,
    respectGitIgnore: true,
  });
  assert.deepEqual(speedSearch.entries, []);

  await assert.rejects(
    host.replaceWorkspaceText(
      root,
      SENTINEL,
      'changed',
      [{ path: ignoredNames.at(-1), mtime: 0 }],
      { includeExcluded: true },
    ),
    /target is outside search scope/u,
  );
});
