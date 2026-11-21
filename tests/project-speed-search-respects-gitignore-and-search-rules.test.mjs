import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

async function createFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-speed-search-rules-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-dir/\n', 'utf8');
  await mkdir(join(root, 'ignored-dir'));
  await writeFile(join(root, 'ignored-dir', 'speed-needle-hidden.txt'), '', 'utf8');
  await mkdir(join(root, 'excluded-dir', 'keep'), { recursive: true });
  await writeFile(join(root, 'excluded-dir', 'speed-needle-dropped.txt'), '', 'utf8');
  await writeFile(join(root, 'excluded-dir', 'keep', 'speed-needle-kept.txt'), '', 'utf8');
  await writeFile(join(root, 'speed-needle-visible.txt'), '', 'utf8');
  return root;
}

test('Project speed search excludes Git ignored and user-excluded directories', async (t) => {
  const root = await createFixture(t);
  const searchDirectoryRules = {
    excludedDirectories: ['excluded-dir'],
    includedDirectories: ['excluded-dir/keep'],
  };
  const result = await host.workspaceFileOperations.search(root, 'speed-needle', {
    showHidden: true,
    showExcluded: true,
    respectGitIgnore: true,
    searchDirectoryRules,
  });
  assert.deepEqual(
    result.entries.map((entry) => entry.path).sort(),
    ['excluded-dir/keep/speed-needle-kept.txt', 'speed-needle-visible.txt'],
  );
});

test('ProjectPanel forwards Git ignore and shared search directory rules', () => {
  assert.match(panelSource, /searchDirectoryRules: SearchDirectoryRules/u);
  assert.match(panelSource, /respectGitIgnore: true,\s+searchDirectoryRules/u);
  assert.match(panelSource, /\[[^\]]*searchDirectoryRules[^\]]*\]\)/u);
  assert.match(editorSource, /<ProjectPanel[\s\S]*?searchDirectoryRules=\{searchDirectoryRules\}/u);
});
