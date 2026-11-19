import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const promptUrl = new URL('../src/client/components/commit/NamePrompt.tsx', import.meta.url);

test('commit name prompt returns invalid submissions to the editable name field', async () => {
  const prompt = await readFile(promptUrl, 'utf8');

  assert.match(prompt, /if \(error === null\) return undefined;/u);
  assert.match(
    prompt,
    /const timer = window\.setTimeout\(\(\) => \{\s+inputRef\.current\?\.focus\(\);\s+inputRef\.current\?\.select\(\);\s+\}, 0\);/u,
  );
  assert.match(prompt, /\}, \[error\]\);/u);
});
