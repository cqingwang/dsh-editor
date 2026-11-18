import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function extractFunction(name) {
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
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated function ${name}`);
}

const fileNavMode = extractFunction('diffFileNavModeForWidth');

test('the file navigator degrades before it pushes close outside the diff pane', () => {
  assert.equal(fileNavMode(Number.POSITIVE_INFINITY), 'full');
  assert.equal(fileNavMode(240), 'full');
  assert.equal(fileNavMode(224), 'full');
  assert.equal(fileNavMode(223), 'compact');
  assert.equal(fileNavMode(193), 'compact');
  assert.equal(fileNavMode(160), 'compact');
  assert.equal(fileNavMode(159), 'hidden');
  assert.equal(fileNavMode(Number.NaN), 'full');
});

test('DiffPreview measures the toolbar width and renders the three file-nav modes', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(diff, /const \[diffToolbarWidth, setDiffToolbarWidth\] = React\.useState\(Number\.POSITIVE_INFINITY\)/);
  assert.match(diff, /setDiffToolbarWidth\(\(current(?::\s*[^)]+)?\)\s*=>/);
  assert.match(diff, /const fileNavMode = diffFileNavModeForWidth\(diffToolbarWidth\)/);
  assert.match(diff, /fileNavMode === 'hidden' \? null/u);
  assert.match(diff, /fileNavMode ===\s+'compact'/u);
  assert.match(diff, /className='dsh-editor-file-nav dsh-editor-file-nav-capsule'/);
});

test('the compact file counter is keyboard-operable and keeps the close action', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(diff, /onClick=\{\(event\) => \(event\.shiftKey \? previousFileAction : nextFileAction\)\?\.\(\)\}/u);
  assert.match(diff, /event\.key === 'ArrowLeft'/);
  assert.match(diff, /event\.key === 'ArrowRight'/);
  assert.match(diff, /label=\{t\('editor\.closeDiff'\)\}/u);
});
