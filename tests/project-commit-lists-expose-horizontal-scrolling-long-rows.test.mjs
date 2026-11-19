import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Project and Commit lists both expose horizontal scrolling for long rows', () => {
  const project = source.slice(source.indexOf('treeScroll: {'), source.indexOf('treeSearchRow: {'));
  assert.match(project, /overflowX: 'auto'/);
  assert.match(project, /overflowY: 'auto'/);

  const commit = source.slice(source.indexOf('commitScroll: {'), source.indexOf('commitGroupRow: {'));
  assert.match(commit, /overflow: 'auto'/);
});

test('intrinsic-width rows remain available inside those scroll containers', () => {
  const projectRow = source.slice(source.indexOf('treeRow: {'), source.indexOf('treeRowSelected: {'));
  assert.match(projectRow, /minWidth: 'max-content'/);
  assert.match(projectRow, /width: 'max-content'/);
  assert.match(source, /'data-dsh-changes-list': ''/);
  assert.match(source, /ref: scrollRefs\?\.changes \?\? null/);
});

test('Project and Changes scroll surfaces remain keyboard-focusable trees', () => {
  assert.match(
    source,
    /role='tree'[\s\S]*?aria-busy=\{ariaBusy \? 'true' : undefined\}[\s\S]*?aria-label=\{ariaLabel\}/,
  );
  assert.match(source, /ariaBusy=\{uploadBusy \|\| loading \|\| searchPending\}/);
  assert.match(
    source,
    /tabIndex: 0,\s+role: 'tree',\s+'aria-busy': busy \? 'true' : undefined,\s+'data-dsh-changes-list': ''/,
  );
});
