import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + await readFile(new URL('./fixtures/commit-log.legacy.js', import.meta.url), 'utf8');
const commitLog = source.slice(
  source.indexOf('function CommitLog({'),
  source.indexOf('/* COMMIT_LOG_BOUNDARY */'),
);

test('Commit Log details use the shared theme-aware scroll surface', () => {
  const end = commitLog.lastIndexOf('detail === null');
  assert.notEqual(end, -1);
  const detail = commitLog.slice(Math.max(0, end - 500), end);
  assert.match(detail, /className: 'dsh-editor-tool-scroll'/);
  assert.match(detail, /tabIndex: 0/);
  assert.match(detail, /role: 'region'/);
  assert.match(detail, /'aria-label': t\('editor\.commitDetails'\)/);
});

test('Terminal tabs keep IDEA overflow-menu semantics instead of horizontal scrolling', () => {
  const terminalTabs = source.slice(source.indexOf('terminalTabs: {'), source.indexOf('terminalOverflow: {'));
  assert.match(terminalTabs, /overflow: 'hidden'/);
  assert.doesNotMatch(terminalTabs, /overflowX: 'auto'/);
  assert.match(source, /const tabLayout = overflowTabs\(dockTerminals/);
  assert.match(source, /className: 'dsh-editor-terminal-overflow'/);
});
