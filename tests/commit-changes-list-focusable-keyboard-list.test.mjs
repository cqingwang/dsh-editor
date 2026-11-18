import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSource = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = `${panelSource}\n${workspaceSource}`;

test('the Changes list is a focusable keyboard list', () => {
  assert.match(panelSource, /ref=\{scrollRefs\?\.changes \?\? null\}/);
  assert.match(panelSource, /tabIndex=\{0\}/);
  assert.match(panelSource, /onKeyDown=\{\(event\) => onChangesKeyDown\?\.\(event\)\}/);
  assert.match(panelSource, /role='tree'/);
  assert.match(panelSource, /data-dsh-changes-list=''/);
});

test('each change row exposes its group and path to keyboard selection', () => {
  assert.match(panelSource, /data-dsh-change-path=\{change\.path\}/);
  assert.match(panelSource, /data-dsh-change-staged=\{group\.id === 'staged'\}/);
  assert.match(panelSource, /tabIndex=\{selectedForChange \? 0 : -1\}/);
  assert.match(panelSource, /onKeyDown=\{\(event\) => \{[\s\S]*?onChangesKeyDown\?\.\(event\)/);
  assert.match(panelSource, /onChangesKeyDown,\s+onChangesKeyUp,\s+changeRowRefs,/);
  assert.match(panelSource, /changeRowRefs\.current\.set/);
});

test('keyboard movement selects rows without opening a diff', () => {
  const handler = workspaceSource.slice(
    workspaceSource.indexOf('const onChangesKeyDown = React.useCallback('),
    workspaceSource.indexOf('const toggleCommitGroup = React.useCallback('),
  );
  assert.match(handler, /event\.key === 'ArrowDown'/);
  assert.match(handler, /event\.key === 'ArrowUp'/);
  assert.match(handler, /event\.key === 'Home'/);
  assert.match(handler, /event\.key === 'End'/);
  assert.match(handler, /event\.key === 'Enter'/);
  assert.match(handler, /chooseChange\(\{/);
  assert.match(handler, /shift: event\.shiftKey/);
  assert.match(handler, /if \(event\.key === 'Enter'\)[\s\S]*setDiffTarget/);
  assert.match(handler, /if \(focused !== node && focused !== event\.target\)\s+return;/);
  assert.match(handler, /event\.stopPropagation\(\);/);
});

test('Space toggles the selected checkbox on keyup, after the browser default is blocked', () => {
  const keyup = workspaceSource.slice(
    workspaceSource.indexOf('const onChangesKeyUp = React.useCallback('),
    workspaceSource.indexOf('const toggleCommitGroup = React.useCallback('),
  );
  assert.match(keyup, /event\.key !== ' ' && event\.key !== 'Spacebar'/);
  assert.match(keyup, /toggleCommitPath\(path\)/);
  assert.match(panelSource, /onKeyUp=\{\(event\) => onChangesKeyUp\?\.\(event\)\}/);
});

test('a git refresh keeps user checkbox choices instead of selecting everything again', () => {
  const load = workspaceSource.slice(
    workspaceSource.indexOf('const loadGit = React.useCallback'),
    workspaceSource.indexOf('const COMMIT_TEMPLATES'),
  );
  assert.match(load, /setCommitSelection\(\(current\) =>/);
  assert.match(load, /commitSelectionLoadedRef\.current === false/);
  assert.match(load, /filter\(\(path\) => changes\.some/);
  assert.doesNotMatch(load, /setCommitSelection\(new Set\(\(value\?\.changes \?\? \[\]\)\.map/);
});
