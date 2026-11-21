import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const componentSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');
const iconSource = await readFile(new URL('../src/client/components/ui/Icon.tsx', import.meta.url), 'utf8');

test('compact Find counts keep numeric matches, files and truncation semantics', () => {
  const compact = loadTypeScriptFunction(commitSource, 'findToolCompactCount');
  assert.deepEqual(compact(5, 4, false, false), { count: 5, fileCount: 4, truncated: false });
  assert.deepEqual(compact(200, 6, false, true), { count: 200, fileCount: 6, truncated: true });
  assert.deepEqual(compact(7, 0, true, false), { count: 7, fileCount: null, truncated: false });
  assert.deepEqual(compact(-2, -3, false, true), { count: 0, fileCount: 0, truncated: true });
});

test('Find count uses match and file-stack icons while retaining the full accessible summary', () => {
  assert.match(componentSource, /const resultCount = findToolCompactCount\(/u);
  assert.match(componentSource, /data-dsh-find-count-compact=''/u);
  assert.match(componentSource, /style=\{styles\.findToolCompactCountGroup\}/u);
  assert.match(componentSource, /name='matchCount'/u);
  assert.match(componentSource, /name='fileStack'/u);
  assert.match(componentSource, /resultCount\.truncated \? '≥' : ''/u);
  assert.match(componentSource, /title=\{resultCountText\}/u);
  assert.match(inlineStyles, /findToolCompactCount: \{[\s\S]*?display: 'inline-flex'/u);
  assert.match(inlineStyles, /findToolCompactCountGroup: \{[\s\S]*?flex: '0 0 auto'/u);
  assert.match(iconSource, /case 'matchCount':/u);
  assert.match(iconSource, /case 'fileStack':/u);
});
