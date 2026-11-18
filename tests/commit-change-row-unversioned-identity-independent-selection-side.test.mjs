import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  extractUseEffectExpressionAfter,
  loadTypeScriptCallback,
  loadTypeScriptExpression,
  loadTypeScriptFunction,
} from './ts-source.mjs';

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
  const revealed = [];
  const groupByFocusRef = { current: null };
  const applyChangeGroupBy = loadTypeScriptCallback(source, 'applyChangeGroupBy', {
    setGroupBy: () => {},
    window: { localStorage: { setItem: () => {} } },
    selectedChangeRef: { current: { path: 'src/a.ts', staged: false } },
    groupByFocusRef,
    revealChangeRow: (target) => revealed.push(target),
  });
  applyChangeGroupBy('directory');
  assert.deepEqual(groupByFocusRef.current, { path: 'src/a.ts', staged: false });
  assert.deepEqual(revealed, [{ path: 'src/a.ts', staged: false }]);

  let focused = false;
  let scrolled = false;
  const row = {
    focus: () => {
      focused = true;
    },
    scrollIntoView: () => {
      scrolled = true;
    },
  };
  const effect = loadTypeScriptExpression(source, extractUseEffectExpressionAfter(source, 'const groupByFocusRef ='), {
    groupByFocusRef,
    changeRowRefs: { current: new Map([['unstaged:src/a.ts', row]]) },
    document: { querySelectorAll: () => [] },
  });
  effect();
  assert.equal(focused, true);
  assert.equal(scrolled, true);
  assert.equal(groupByFocusRef.current, null);
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
