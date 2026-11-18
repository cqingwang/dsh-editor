import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CodePreviewCode is a reusable TSX preview component', async () => {
  const preview = await read('src/client/components/commit/CodePreviewCode.tsx');

  assert.match(preview, /export interface CodePreviewCodeProps/u);
  assert.match(preview, /className='dsh-editor-code-preview-code'/u);
  assert.match(preview, /codePreviewMatchRanges\(segments\)/u);
  assert.match(preview, /markCodePreviewMatches\(node, ranges\)/u);
  assert.doesNotMatch(preview, /React\.createElement/u);
});

test('build embeds CodePreviewCode and legacy commit.js has no duplicate component', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/commit.ts');

  assert.match(build, /CodePreviewCode\.tsx/u);
  assert.match(build, /codePreviewCodeModule/u);
  assert.doesNotMatch(legacy, /function CodePreviewCode\(/u);
});
