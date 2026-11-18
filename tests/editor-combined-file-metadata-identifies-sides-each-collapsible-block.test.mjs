import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitCombinedDiff } from '../lib/index.js';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const diffSource = readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8');
const combinedSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');
const localesSource = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
const source = `${diffSource}\n${combinedSource}\n${localesSource}`;
const combinedFileHiddenRange = loadTypeScriptFunction(combinedSource, 'combinedFileHiddenRange');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r318-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'old-a\n');
  await writeFile(join(dir, 'b.txt'), 'old-b\nline\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  await writeFile(join(dir, 'a.txt'), 'new-a\n');
  await writeFile(join(dir, 'b.txt'), 'new-b\nline\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('combined file metadata identifies both sides of each collapsible block', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitCombinedDiff(dir, '', {
    entries: [
      { path: 'a.txt', staged: false },
      { path: 'b.txt', staged: false },
    ],
  });
  for (const file of value.files) {
    assert.ok(file.originalLine >= 1);
    assert.ok(file.originalEndLine >= file.originalLine);
    assert.ok(file.line >= 1);
    assert.ok(file.endLine >= file.line);
  }
  assert.match(value.original.split('\n')[value.files[0].originalLine - 1], /a\.txt/u);
  assert.match(value.modified.split('\n')[value.files[1].line - 1], /b\.txt/u);
});

test('combinedFileHiddenRange preserves the heading and targets only its content', () => {
  const file = { line: 10, endLine: 14, originalLine: 5, originalEndLine: 8 };
  assert.deepEqual(combinedFileHiddenRange(file, 'modified'), { startLineNumber: 11, endLineNumber: 14 });
  assert.deepEqual(combinedFileHiddenRange(file, 'original'), { startLineNumber: 6, endLineNumber: 8 });
  assert.equal(combinedFileHiddenRange({ line: 2, endLine: 2 }, 'modified'), null);
  assert.equal(combinedFileHiddenRange(null, 'modified'), null);
});

test('DiffPreview applies collapsed state as non-destructive hidden areas', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(
    diff,
    /const \[collapsedCombinedFiles, setCollapsedCombinedFiles\] = React\.useState(?:<[^()]*>)?\(\(\) => new Set\(\)\)/,
  );
  assert.match(diff, /const toggleCombinedFileCollapse = React\.useCallback\(/);
  assert.match(diff, /getModifiedEditor\(\)\.setHiddenAreas\(/);
  assert.match(diff, /getOriginalEditor\(\)\.setHiddenAreas\(/);
  assert.match(diff, /combinedFileHiddenRange\(/);
  assert.match(diff, /id: 'collapseCombinedFile'/);
  assert.ok(source.includes("collapseCombinedFile: '折叠当前文件'"));
  assert.ok(source.includes("expandCombinedFile: '展开当前文件'"));
  assert.ok(source.includes("collapseCombinedFile: 'Collapse File'"));
  assert.ok(source.includes("expandCombinedFile: 'Expand File'"));
});
