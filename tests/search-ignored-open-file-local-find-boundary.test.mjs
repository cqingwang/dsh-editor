import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const { editorFindResult } = loadTypeScriptModule(terminalSource, ['editorFindResult']);
const CONTENT = `<?xml version="1.0" encoding="UTF-8"?>\n<component name="VcsDirectoryMappings" />\n`;

test('an ignored file keeps editor-local Find while global search excludes it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-ignored-open-find-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await writeFile(join(root, '.gitignore'), 'ignored-dir/\n', 'utf8');
  await mkdir(join(root, 'ignored-dir'));
  await writeFile(join(root, 'ignored-dir', 'vcs.xml'), CONTENT, 'utf8');
  await writeFile(join(root, 'visible.txt'), 'ordinary file\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'add', '.gitignore', 'visible.txt']);

  const local = editorFindResult(CONTENT, 'VcsDirectoryMappings');
  assert.equal(local.matches.length, 1);
  assert.equal(local.matches[0].text, 'VcsDirectoryMappings');

  const global = await host.searchWorkspaceText(root, 'VcsDirectoryMappings', { maxMatches: 20 });
  assert.deepEqual(global.matches, []);

  const explicitIgnoredTarget = await host.searchWorkspaceText(root, 'VcsDirectoryMappings', {
    maxMatches: 20,
    allowedPaths: ['ignored-dir/vcs.xml'],
  });
  assert.deepEqual(explicitIgnoredTarget.matches, []);

  await assert.rejects(
    host.replaceWorkspaceText(
      root,
      'VcsDirectoryMappings',
      'ChangedMappings',
      [{ path: 'ignored-dir/vcs.xml', mtime: 0 }],
      { allowedPaths: ['ignored-dir/vcs.xml'] },
    ),
    /target is outside search scope/u,
  );
});
