import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index + 2);
      if (newline < 0) return source.slice(start);
      index = newline;
      continue;
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      assert.notEqual(end, -1, `unterminated comment in ${name}`);
      index = end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated function ${name}`);
}

function changeNavigation() {
  const names = [
    'basename',
    'dirname',
    'splitChanges',
    'listedInChangeBand',
    'sortChangeTree',
    'changeTreeOf',
    'collectChanges',
    'flattenChangeTree',
    'groupingDepth',
    'changeSequenceOf',
    'changePositionOf',
  ];
  const body = names.map(functionSource).join('\n');
  return new Function(`${body}; return { changeSequenceOf, changePositionOf, splitChanges, listedInChangeBand };`)();
}

test('change-file navigation follows the visible staged, unstaged and unversioned order', () => {
  const { changeSequenceOf } = changeNavigation();
  const sequence = changeSequenceOf([
    { path: 'src/beta.ts', status: 'M ' },
    { path: 'README.md', status: ' M' },
    { path: 'zeta.txt', status: '??' },
    { path: 'docs/alpha.md', status: 'M ' },
  ], 'directory');
  assert.deepEqual(sequence, [
    { path: 'docs/alpha.md', staged: true },
    { path: 'src/beta.ts', staged: true },
    { path: 'README.md', staged: false },
    { path: 'zeta.txt', staged: false },
  ]);
});

test('change-file position keeps the staged and working copies of an MM path distinct', () => {
  const { changeSequenceOf, changePositionOf } = changeNavigation();
  const sequence = changeSequenceOf([{ path: 'same.txt', status: 'MM' }], 'flat');
  assert.deepEqual(changePositionOf(sequence, { path: 'same.txt', staged: true }), { index: 1, total: 2 });
  assert.deepEqual(changePositionOf(sequence, { path: 'same.txt', staged: false }), { index: 2, total: 2 });
  assert.equal(changePositionOf(sequence, { path: 'missing.txt', staged: false }), null);
});

test('the unstaged namespace keeps unversioned files alive across status polls', () => {
  const { splitChanges, listedInChangeBand } = changeNavigation();
  const bands = splitChanges([
    { path: 'tracked.txt', status: ' M' },
    { path: 'new.txt', status: '??' },
  ]);
  assert.equal(listedInChangeBand(bands, 'unstaged', 'tracked.txt'), true);
  assert.equal(listedInChangeBand(bands, 'unstaged', 'new.txt'), true);
  assert.equal(listedInChangeBand(bands, 'staged', 'new.txt'), false);
  assert.equal(listedInChangeBand(bands, 'unstaged', 'gone.txt'), false);
});

test('Diff exposes IDEA compare-file navigation with its native shortcut', () => {
  assert.match(source, /previousFile: '上一个文件',/);
  assert.match(source, /nextFile: '下一个文件',/);
  assert.match(source, /filePosition: diffFilePosition,/);
  assert.match(source, /className='dsh-editor-file-nav'/);
  assert.match(source, /event\.ctrlKey &&\s+event\.shiftKey &&\s+!event\.altKey &&\s+!event\.metaKey/u);
  assert.match(source, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(source, /previousFileAction\?\.\(\)/);
  assert.match(source, /nextFileAction\?\.\(\)/);
});
