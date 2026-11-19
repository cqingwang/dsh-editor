import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));

test('Project tree exposes recursive speed search as busy', () => {
  assert.match(component, /ariaBusy=\{uploadBusy \|\| loading \|\| searchPending\}/u);
  assert.match(component, /aria-busy=\{ariaBusy \? 'true' : undefined\}/u);
  assert.match(component, /setSearchPending\(true\)/u);
  assert.match(component, /setSearchPending\(false\)/u);
});
