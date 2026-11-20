import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('hiding a tool window returns keyboard ownership to the editor surface', () => {
  const start = workspace.indexOf('const hideToolWindow = React.useCallback(');
  const end = workspace.indexOf('const selectActivity = React.useCallback(', start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const hide = workspace.slice(start, end);
  assert.match(hide, /setPanelVisible\(false\);/u);
  assert.match(hide, /focusWorkspaceSurface\(\);/u);
  assert.equal((workspace.match(/onHide=\{hideToolWindow\}/gu) ?? []).length, 2);
});

test('activity stripe activation focuses the Project or Commit content it reveals', () => {
  const start = workspace.indexOf('const selectActivity = React.useCallback(');
  const end = workspace.indexOf('/* The first Alt+F1 of IDEA', start);
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const select = workspace.slice(start, end);

  assert.match(
    select,
    /if \(panelVisibleRef\.current === true\) \{\s+hideToolWindow\(\);\s+return;\s+\}\s+setPanelVisible\(true\);\s+window\.setTimeout\(\(\) => focusToolWindowContent\(next\), 0\);/u,
  );
  assert.match(
    select,
    /setActivity\(next\);\s+setPanelVisible\(true\);\s+window\.setTimeout\(\(\) => focusToolWindowContent\(next\), 0\);/u,
  );
  assert.doesNotMatch(select, /if \(options\?\.keyboard === true\) window\.setTimeout/u);
});
