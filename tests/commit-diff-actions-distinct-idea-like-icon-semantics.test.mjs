import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const iconSource = await readFile(new URL('../src/client/components/ui/Icon.tsx', import.meta.url), 'utf8');

function actionBlock(actionId) {
  const marker = `id: '${actionId}'`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${actionId} action should exist`);
  const end = source.indexOf("\n                },", start);
  assert.ok(end > start, `${actionId} action should have a bounded block`);
  return source.slice(start, end);
}

test('Commit diff actions use distinct IDEA-like icon semantics', () => {
  assert.match(actionBlock('showDiff'), /icon: 'diff'/);
  assert.match(actionBlock('combinedDiff'), /icon: 'combinedDiff'/);
  assert.match(actionBlock('copyPatch'), /icon: 'clipboard'/);
  assert.match(actionBlock('createPatch'), /icon: 'patchExport'/);
});

test('the distinct Commit action icons are declared in Icon', () => {
  for (const name of ['diff', 'combinedDiff', 'clipboard', 'patchExport']) {
    assert.match(iconSource, new RegExp(`case '${name}':`));
  }
});

test('Select Opposite Diff Pane has its own switch-pane icon', () => {
  const marker = "id: 'focusOppositePane'";
  const start = source.indexOf(marker);
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 420);
  assert.match(block, /icon: 'switchPane'/);
  assert.match(iconSource, /case 'switchPane':/);
});
