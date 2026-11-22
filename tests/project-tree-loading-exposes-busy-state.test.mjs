import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));

test('Project tree marks both filesystem loading and uploads as busy', () => {
  assert.match(
    component,
    /ariaBusy=\{uploadBusy \|\| searchIndexRebuilding \|\| searchIndexClearing \|\| loading \|\| searchPending\}/u,
  );
  assert.match(
    component,
    /role='tree'[\s\S]*?aria-busy=\{ariaBusy \? 'true' : undefined\}[\s\S]*?aria-label=\{ariaLabel\}/u,
  );
});
