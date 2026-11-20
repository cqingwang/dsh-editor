import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('Project speed search closes before inline create or rename owns the keyboard', () => {
  assert.match(
    projectSource,
    /React\.useEffect\(\(\) => \{[\s\S]*?if \(!searchOpen \|\| \(createState === null && renameState === null\)\) return undefined;[\s\S]*?closeTreeSearch\(\);[\s\S]*?\}, \[closeTreeSearch, createState, renameState, searchOpen\]\);/u,
  );
});
