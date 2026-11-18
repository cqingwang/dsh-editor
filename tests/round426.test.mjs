import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/commit-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('the amend checkbox exposes the localized IDEA action name', () => {
  const commit = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function groupActionMenuItems('));
  const start = commit.indexOf('style: styles.amendRow');
  assert.notEqual(start, -1, 'amend row should exist');
  const row = commit.slice(start, commit.indexOf("t('editor.commitMessageHistory')", start));
  assert.match(row, /type: 'checkbox'/);
  assert.match(row, /'aria-label': t\('editor\.amend'\)/);
  assert.match(row, /checked: amend/);
  assert.match(row, /onChange: \(event\) => onAmend\(event\.target\.checked\)/);
});
