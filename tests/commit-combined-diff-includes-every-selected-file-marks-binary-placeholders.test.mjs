import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCombinedDiff } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = (
  readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') +
  '\n' +
  workspaceSource +
  '\n' +
  readFileSync(join(root, 'src/client/diff.ts'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8')
);
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r316-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'a-old\n');
  await writeFile(join(dir, 'b.txt'), 'b-old\n');
  await writeFile(join(dir, 'image.bin'), Buffer.from([0, 1, 2]));
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('combined diff includes every selected file and marks binary placeholders', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await writeFile(join(dir, 'a.txt'), 'a-new\n');
  await writeFile(join(dir, 'b.txt'), 'b-new\n');
  await writeFile(join(dir, 'image.bin'), Buffer.from([0, 3, 4]));

  const value = await gitCombinedDiff(dir, '', {
    entries: [
      { path: 'a.txt', staged: false },
      { path: 'b.txt', staged: false },
      { path: 'image.bin', staged: false },
    ],
  });

  assert.equal(value.files.length, 3);
  assert.match(value.original, /a\.txt/u);
  assert.match(value.modified, /b\.txt/u);
  assert.match(value.original, /a-old/u);
  assert.match(value.modified, /b-new/u);
  assert.match(value.original, /image\.bin/u);
  assert.equal(value.original.includes('\u0000'), false);
  assert.equal(value.modified.includes('\u0000'), false);
});

test('combined diff has one host operation and a bounded file list', () => {
  assert.match(host, /async function gitCombinedDiff\(/);
  assert.match(host, /case 'combinedDiff':/);
  assert.match(host, /export \{[^}]*gitCombinedDiff/);
  assert.match(host, /combined diff supports at most/u);
});

test('Commit offers Show Combined Diff and the preview requests the aggregate', () => {
  assert.ok(source.includes("showCombinedDiff: '显示所选文件的合并差异'"));
  assert.ok(source.includes("showCombinedDiff: 'Show Combined Diff'"));
  assert.match(source, /id: 'combinedDiff'/);
  assert.match(source, /op: 'combinedDiff'/);
  assert.match(source, /target\.combined === true/);
  assert.match(source, /combined: true/);
});

test('combined diff is read-only and cannot show single-file restore affordances', () => {
  assert.match(
    source,
    /const diffReadOnly =\s+typeof target\?\.commit === 'string' \|\|\s+typeof target\?\.revision === 'string' \|\|\s+typeof target\?\.clipboardText === 'string' \|\|\s+target\?\.combined === true;/u,
  );
  assert.match(source, /target\?\.combined === true \? null : \(\s*<div\s+style=\{styles\.diffRestoreHint\}/u);
  assert.match(
    workspaceSource,
    /typeof current\.revision === 'string' \|\|\s+typeof current\.commit === 'string' \|\|\s+current\.combined === true\s+\)\s+return current;/,
  );
});
