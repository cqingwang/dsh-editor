import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('Diff Go To Change uses the existing Monaco hunks and ContextMenu', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[hunkMenu, setHunkMenu\] = React\.useState\(null\)/);
  assert.match(diff, /const jumpToDiffHunk = React\.useCallback\(\(index\) => \{/);
  assert.match(diff, /const openHunkMenu = React\.useCallback\(\(event\) => \{/);
  assert.match(diff, /getLineChanges\(\) \?\? \[\]/);
  assert.match(diff, /const position = \{ lineNumber: Math\.max\(1, Number\(change\.modifiedStartLineNumber\) \|\| 1\), column: 1 \}/);
  assert.match(diff, /editor\.setPosition\(position\)/);
  assert.match(diff, /role: 'button'/);
  assert.match(diff, /onClick: \(event\) => openHunkMenu\(event\)/);
  assert.match(diff, /hunkMenu === null \? null : React\.createElement\(ContextMenu/);
});

test('narrow diff overflow still exposes Go To Change', () => {
  const diff = diffPreview();
  assert.match(diff, /id: 'goToChange'/);
  assert.match(diff, /label: t\('editor\.goToChange'\)/);
  assert.match(diff, /run: \(\) => openHunkMenu\(\)/);
});

test('Go To Change wording exists in both dictionaries', () => {
  for (const key of ['goToChange', 'goToChangeHint', 'changeAtLine']) {
    assert.ok(source.split(`${key}:`).length - 1 >= 2, `${key} must exist in both dictionaries`);
  }
});
