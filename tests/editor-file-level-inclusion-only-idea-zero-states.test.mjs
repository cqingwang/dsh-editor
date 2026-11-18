import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

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

test('file-level inclusion has only the IDEA zero/all states', () => {
  const fn = new Function(`${extractFunction('diffIncludedSummaryState')}; return diffIncludedSummaryState;`)();
  assert.equal(fn(0, false), null);
  assert.equal(fn(0, true), null);
  assert.equal(fn(2, false), 'none');
  assert.equal(fn(2, true), 'all');
});

test('the difference summary folds out before it can crowd the toolbar', () => {
  const fn = new Function(`${extractFunction('diffSummaryVisibleForWidth')}; return diffSummaryVisibleForWidth;`)();
  assert.equal(fn(Number.POSITIVE_INFINITY), true);
  assert.equal(fn(380), true);
  assert.equal(fn(379), false);
  assert.equal(fn(200), false);
});

test('DiffPreview renders the included state only for local Commit changes', () => {
  const diffStart = source.indexOf('function DiffPreview(');
  const diffEnd = source.indexOf('export { DiffPreview };', diffStart);
  assert.notEqual(diffStart, -1, 'DiffPreview is missing');
  assert.notEqual(diffEnd, -1, 'DiffPreview end marker is missing');
  const diff = source.slice(diffStart, diffEnd);
  assert.match(diff, /includedInCommit = false/);
  assert.match(diff, /typeof target\?\.commit !== 'string'/);
  assert.match(diff, /typeof target\?\.revision !== 'string'/);
  assert.match(diff, /typeof target\?\.clipboardText !== 'string'/);
  assert.match(diff, /target\?\.combined !== true/);
  assert.match(diff, /diffIncludedSummaryState\(hunks\.total, includedInCommit\)/);
  assert.match(diff, /diffSummaryVisibleForWidth\(diffToolbarWidth\)/);
  assert.match(diff, /includedState === 'all'[\s\S]{0,80}?t\('editor\.diffSummaryAll'/);
  assert.match(diff, /includedState === 'none'[\s\S]{0,80}?t\('editor\.diffSummaryNone'/);
});

test('EditorWorkspace passes the real commit checkbox state into the diff', () => {
  assert.match(source, /includedInCommit: diffTarget === null \? false : commitSelection\.has\(diffTarget\.path\)/);
});

test('both dictionaries expose the difference summary text and truthful hints', () => {
  assert.match(source, /diffSummaryAll: '\{count\} 个差异'/);
  assert.match(source, /diffSummaryNone: '\{count\} 个差异，0 个已包含'/);
  assert.match(source, /diffSummaryAllHint: '文件级提交勾选：此文件已包含到提交'/);
  assert.match(source, /diffSummaryNoneHint: '文件级提交勾选：此文件尚未包含到提交'/);
  assert.match(source, /diffSummaryAll: '\{count\} differences'/);
  assert.match(source, /diffSummaryNone: '\{count\} differences, 0 included'/);
});
