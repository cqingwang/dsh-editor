import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');

test('Project tree marks both filesystem loading and uploads as busy', () => {
  assert.match(component, /aria-busy=\{uploadBusy \|\| loading \|\| searchPending \? 'true' : undefined\}/u);
  assert.match(
    component,
    /role='tree'[\s\S]*?aria-busy=\{uploadBusy \|\| loading \|\| searchPending \? 'true' : undefined\}[\s\S]*?data-dsh-project-tree=/u,
  );
});
