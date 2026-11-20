import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const tree = await readFile(
  new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url),
  'utf8',
);

test('the shared disclosure does not reach the row selection pointerdown', () => {
  assert.match(tree, /data-dsh-tree-disclosure=''/u);
  assert.match(
    tree,
    /onMouseDown=\{\s*onRowPointerDown === undefined\s*\?\s*undefined\s*:\s*\(event\) => \{[\s\S]*?closest\('\[data-dsh-tree-disclosure\]'\)[\s\S]*?return;[\s\S]*?onRowPointerDown\(state, event\);[\s\S]*?\}\s*\}/u,
  );
});

test('pointer disclosure activation keeps keyboard ownership on the tree', () => {
  const disclosureStart = tree.indexOf("data-dsh-tree-disclosure=''");
  const disclosure = tree.slice(disclosureStart, tree.indexOf('onClick=', disclosureStart));
  assert.match(disclosure, /onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/u);
});
