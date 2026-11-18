import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + await readFile(new URL('../src/client/components/commit/CommitLog.tsx', import.meta.url), 'utf8');
const detailSource = await readFile(
  new URL('../src/client/components/commit/CommitLogDetailPane.tsx', import.meta.url),
  'utf8',
);

test('Commit Log details use the shared theme-aware scroll surface', () => {
  assert.match(detailSource, /className='dsh-editor-tool-scroll'/);
  assert.match(detailSource, /tabIndex=\{0\}/);
  assert.match(detailSource, /role='region'/);
  assert.match(detailSource, /aria-label=\{t\('editor\.commitDetails'\)\}/);
});

test('Terminal tabs keep IDEA overflow-menu semantics instead of horizontal scrolling', () => {
  const terminalTabs = source.slice(source.indexOf('terminalTabs: {'), source.indexOf('terminalOverflow: {'));
  assert.match(terminalTabs, /overflow: 'hidden'/);
  assert.doesNotMatch(terminalTabs, /overflowX: 'auto'/);
  assert.match(source, /const tabLayout = overflowTabs\(dockTerminals/);
  assert.match(source, /className: 'dsh-editor-terminal-overflow'/);
});
