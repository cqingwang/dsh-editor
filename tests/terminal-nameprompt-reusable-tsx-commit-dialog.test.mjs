import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('NamePrompt is a reusable TSX commit dialog', async () => {
  const prompt = await read('src/client/components/commit/NamePrompt.tsx');

  assert.match(prompt, /export interface NamePromptProps/u);
  assert.match(prompt, /role='dialog'/u);
  assert.match(prompt, /event\.key === 'Enter'/u);
  assert.match(prompt, /event\.key === 'Escape'/u);
  assert.match(prompt, /disabled=\{state\.value\.trim\(\) === ''\}/u);
  assert.doesNotMatch(prompt, /React\.createElement/u);
});

test('build embeds NamePrompt TSX and legacy commit.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/commit.ts');

  assert.match(build, /NamePrompt\.tsx/u);
  assert.match(build, /namePromptModule/u);
  assert.doesNotMatch(legacy, /function NamePrompt\(/u);
});
