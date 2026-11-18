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
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r317-'));
  execFileSync('git', ['-C', dir, 'init', '-q']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'a-old\n');
  await writeFile(join(dir, 'b.txt'), 'b-old\nmore\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init']);
  await writeFile(join(dir, 'a.txt'), 'a-new\n');
  await writeFile(join(dir, 'b.txt'), 'b-new\nmore\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('combined diff reports the modified-side line of every file heading', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await gitCombinedDiff(dir, '', {
    entries: [
      { path: 'a.txt', staged: false },
      { path: 'b.txt', staged: false },
    ],
  });
  assert.equal(value.files[0].line, 1);
  assert.ok(value.files[1].line > value.files[0].line);
  const lines = value.modified.split('\n');
  assert.match(lines[value.files[0].line - 1], /a\.txt/u);
  assert.match(lines[value.files[1].line - 1], /b\.txt/u);
});

test('combinedFileIndexAtLine clamps before, between and after file headings', () => {
  const fn = new Function(`${extractFunction('combinedFileIndexAtLine')}; return combinedFileIndexAtLine;`)();
  const files = [{ line: 1 }, { line: 4 }, { line: 8 }];
  assert.equal(fn(files, 1), 0);
  assert.equal(fn(files, 3), 0);
  assert.equal(fn(files, 4), 1);
  assert.equal(fn(files, 99), 2);
  assert.equal(fn([], 1), 0);
});

test('combined diff file navigation reuses the toolbar and keyboard path', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /const \[combinedFiles, setCombinedFiles\] = React\.useState\(\[\]\)/);
  assert.match(diff, /const \[combinedPosition, setCombinedPosition\] = React\.useState\(\{ index: 0, total: 0 \}\)/);
  assert.match(diff, /const navigationPosition = target\?\.combined === true \? combinedPosition : filePosition;/);
  assert.match(diff, /const jumpToCombinedFile = React\.useCallback\(/);
  assert.match(diff, /combinedFileIndexAtLine\(combinedFilesRef\.current, line\)/);
  assert.match(diff, /if \(target\?\.combined === true && navigationPosition !== null\)/);
  assert.match(diff, /filePosition === null[\s\S]*?navigationPosition/);
});
