import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the Changes list is a focusable keyboard list', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
  const start = panel.indexOf('ref: scrollRefs?.changes');
  const scroll = panel.slice(start, panel.indexOf('changes.length === 0', start));
  assert.match(scroll, /tabIndex: 0/);
  assert.match(scroll, /onKeyDown: \(event\) => onChangesKeyDown\?\.\(event\)/);
  assert.match(scroll, /role: 'tree'/);
  assert.match(scroll, /'data-dsh-changes-list': ''/);
});

test('each change row exposes its group and path to keyboard selection', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
  const row = panel.slice(panel.indexOf('title: change.path,'), panel.indexOf("React.createElement('input', {", panel.indexOf('title: change.path,')));
  assert.match(row, /'data-dsh-change-path': change.path/);
  assert.match(row, /'data-dsh-change-staged': group.id === 'staged'/);
  assert.match(row, /tabIndex: selectedForChange \? 0 : -1/);
  assert.match(row, /onChangesKeyDown\?\.\(event\)/);
  assert.match(panel, /onChangesKeyDown,\n\s+onChangesKeyUp,\n\s+changeRowRefs,/);
  assert.match(panel, /changeRowRefs\.current\.set/);
});

test('keyboard movement selects rows without opening a diff', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const handler = workspace.slice(workspace.indexOf('const onChangesKeyDown = React.useCallback('), workspace.indexOf('const toggleCommitGroup = React.useCallback('));
  assert.match(handler, /event\.key === 'ArrowDown'/);
  assert.match(handler, /event\.key === 'ArrowUp'/);
  assert.match(handler, /event\.key === 'Home'/);
  assert.match(handler, /event\.key === 'End'/);
  assert.match(handler, /event\.key === 'Enter'/);
  assert.match(handler, /chooseChange\(\{/);
  assert.match(handler, /shift: event\.shiftKey/);
  assert.match(handler, /if \(event\.key === 'Enter'\)[\s\S]*setDiffTarget/);
  assert.match(handler, /if \(focused !== node && focused !== event\.target\) return;/);
  assert.match(handler, /event\.stopPropagation\(\);/);
});

test('Space toggles the selected checkbox on keyup, after the browser default is blocked', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  const keyup = workspace.slice(workspace.indexOf('const onChangesKeyUp = React.useCallback('), workspace.indexOf('const toggleCommitGroup = React.useCallback('));
  assert.match(keyup, /event\.key !== ' ' && event\.key !== 'Spacebar'/);
  assert.match(keyup, /toggleCommitPath\(path\)/);
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
  assert.match(panel, /onKeyUp: \(event\) => onChangesKeyUp\?\.\(event\)/);
});

test('a git refresh keeps user checkbox choices instead of selecting everything again', () => {
  const load = source.slice(source.indexOf('const loadGit = React.useCallback'), source.indexOf('const COMMIT_TEMPLATES'));
  assert.match(load, /setCommitSelection\(\(current\) =>/);
  assert.match(load, /commitSelectionLoadedRef\.current === false/);
  assert.match(load, /filter\(\(path\) => changes\.some/);
  assert.doesNotMatch(load, /setCommitSelection\(new Set\(\(value\?\.changes \?\? \[\]\)\.map/);
});
