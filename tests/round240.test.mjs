import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { compactActionBarSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'tests/fixtures/commit-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'tests/fixtures/commit-log.legacy.js'), 'utf8');

test('the minimum-width Changes pane hides line counts before clipping the name', () => {
  const narrow = source.slice(
    source.indexOf('@container dsh-editor-side (max-width: 210px)'),
    source.indexOf('@container dsh-editor-editor (max-width: 440px)', source.indexOf('@container dsh-editor-side (max-width: 210px)')),
  );
  assert.match(narrow, /@container dsh-editor-side \(max-width: 205px\)/);
  assert.match(narrow, /\.dsh-editor-line-counts \{ display: none !important; \}/);
  assert.ok(
    narrow.indexOf('max-width: 205px') > narrow.indexOf('max-width: 210px'),
    'the stricter rule must come after the half-reading rule',
  );
});

test('the Changes action bar keeps View Options and reserves its overflow slot', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLog('));
  assert.match(panel, /id: 'viewOptions'/);
  const actionBar = compactActionBarSource;
  assert.match(actionBar, /Math\.max\(0, slots - 1\)/);
  assert.match(actionBar, /selectCompactActions\(actions, visibleCount\)/);
  assert.match(actionBar, /visibleActions\.includes\(action\) === false/);
});
