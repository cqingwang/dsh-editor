import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/diff-preview.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Monaco restore gutter has a pointer cursor and accent hover feedback', () => {
  assert.match(source, /\.dsh-editor-diff-pane \.revertButton \{/);
  assert.match(source, /cursor: pointer !important/);
  assert.match(source, /\.dsh-editor-diff-pane \.revertButton:hover \{/);
  assert.match(source, /background: var\(--dsw-alias-state-business-primary\) !important/);
  assert.match(source, /color: #fff !important/);
  assert.match(source, /transition: background-color 0\.09s linear, color 0\.09s linear/);
});

test('the restore gutter keeps a visible keyboard focus ring', () => {
  assert.match(source, /\.dsh-editor-diff-pane \.revertButton:focus-visible \{/);
  assert.match(source, /outline: 1px solid var\(--dsw-alias-state-business-primary\) !important/);
  assert.match(source, /outline-offset: 1px !important/);
});

test('the diff overflow menu closes when the layout expands again', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /React\.useEffect\(\(\) => \{\s+if \(!diffActionsCompact\) setDiffActionMenu\(null\);\s+\}, \[diffActionsCompact\]\);/);
});
