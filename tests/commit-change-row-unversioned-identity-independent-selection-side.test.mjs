import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const diffModelSource = readFileSync(join(root, 'src/client/diff.ts'), 'utf8');
const commitOptionsSource = readFileSync(
  join(root, 'src/client/components/commit/commit-options-menu.ts'),
  'utf8',
);
const changeRowGroup = loadTypeScriptFunction(diffModelSource, 'changeRowGroup');

test('a change row keeps its unversioned identity independent of selection side', () => {
  const group = changeRowGroup;
  assert.equal(group({ status: '??' }, false), 'unversioned');
  assert.equal(group({ status: '??' }, true), 'unversioned');
  assert.equal(group({ status: 'M ' }, true), 'staged');
  assert.equal(group({ status: ' M' }, false), 'unstaged');
  assert.equal(group({ status: 'MM' }, false), 'unstaged');
});

test('changing Group by reveals and focuses the current Change row', () => {
  const workspace = source;
  const block = workspace.slice(
    workspace.indexOf('const applyChangeGroupBy = React.useCallback('),
    workspace.indexOf('const changeGroupMenu = React.useCallback(', workspace.indexOf('const applyChangeGroupBy = React.useCallback(')),
  );
  assert.notEqual(block.length, 0);
  assert.match(block, /selectedChangeRef\.current/);
  assert.match(block, /groupByFocusRef\.current = \{\s+path: selected\.path,\s+staged: selected\.staged === true,\s+\}/u);
  assert.match(block, /revealChangeRow\(selected\);/);
  const focusEffect = workspace.slice(
    workspace.indexOf('const groupByFocusRef = React.useRef(null);'),
    workspace.indexOf('/* The change-list filter;', workspace.indexOf('const groupByFocusRef = React.useRef(null);')),
  );
  assert.match(focusEffect, /changeRowRefs\.current\.get\(key\)/);
  assert.match(focusEffect, /row\.focus\?\.\(\)/);
  assert.match(focusEffect, /scrollIntoView\?\.\(\{ block: 'nearest' \}\)/);
});

test('Group by items call the reveal-aware apply path', () => {
  const block = commitOptionsSource.slice(
    commitOptionsSource.indexOf('export function changeGroupMenu('),
    commitOptionsSource.indexOf('export function changesViewOptionsMenu('),
  );
  assert.match(block, /run: \(\) => onApplyChangeGroupBy\(mode\)/);
  assert.match(block, /restoreFocus: false/);
  assert.match(source, /onApplyChangeGroupBy: applyChangeGroupBy/);
});
