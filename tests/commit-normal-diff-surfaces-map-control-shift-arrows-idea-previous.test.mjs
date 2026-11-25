import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));

test('normal Diff surfaces map control-shift arrows to IDEA previous/next file', () => {
  const start = diff.indexOf('event.ctrlKey &&\n        event.shiftKey');
  assert.notEqual(start, -1, 'diff control-shift branch should exist');
  const block = diff.slice(start, diff.indexOf("Monaco's Close Tab action", start));
  assert.match(block, /if \(navigationPosition !== null\) \{/);
  assert.match(block, /if \(event\.key === 'ArrowLeft'\) previousFileAction\?\.\(\);\s+else nextFileAction\?\.\(\);/s);
  assert.match(block, /walkHunk\('previous'\)/);
  assert.match(block, /walkHunk\('next'\)/);
});

test('control-shift change navigation stays scoped to the diff pane', () => {
  const start = diff.indexOf('const onKeyDown = (event');
  const block = diff.slice(start, diff.indexOf("Monaco's Close Tab action", start));
  assert.match(block, /insideDiffPane/);
  assert.match(block, /event\.preventDefault\(\)/);
  assert.match(block, /event\.stopPropagation\(\)/);
});
