import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(
  new URL('../src/client/editor-workspace.tsx', import.meta.url),
  'utf8',
);

test('Project multi-selection disables actions that only target the primary row', () => {
  for (const id of ['reveal', 'openTerminal', 'revealFinder']) {
    assert.match(
      workspace,
      new RegExp(`id: '${id}',[\\s\\S]{0,500}?disabled: batch\\.length > 1,`, 'u'),
      `${id} must be disabled for multi-selection`,
    );
  }
  assert.match(
    workspace,
    /id: 'history',[\s\S]{0,300}?disabled: isRoot \|\| batch\.length > 1,/u,
  );
});

test('global refresh remains available for every selection size', () => {
  assert.match(workspace, /id: 'refresh',[\s\S]{0,300}?run: \(\): void => void refreshTree\(\)/u);
});
