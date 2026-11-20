import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const modelSource = await readFile(
  new URL('src/client/components/diff/conflict-marker-model.ts', root),
  'utf8',
);
const diffSource = await readFile(new URL('src/client/components/diff/DiffPreview.tsx', root), 'utf8');
const cssSource = await readFile(new URL('src/client/injected-css.ts', root), 'utf8');
const buildSource = await readFile(new URL('scripts/build-client.mjs', root), 'utf8');
const conflictMarkerLineNumbers = loadTypeScriptFunction(modelSource, 'conflictMarkerLineNumbers');

test('Git conflict marker lines are identified without touching ordinary separators', () => {
  const text = [
    'ordinary ======= text',
    '<<<<<<< ours',
    'ours',
    '=======',
    'theirs',
    '>>>>>>> theirs',
  ].join('\n');
  assert.deepEqual(conflictMarkerLineNumbers(text), [2, 4, 6]);
});

test('DiffPreview applies and clears IDEA conflict marker decorations', () => {
  assert.match(diffSource, /conflictMarkerLineNumbers/u);
  assert.match(diffSource, /dsh-editor-conflict-marker-line/u);
  assert.match(diffSource, /conflictMarkerCollectionsRef/u);
  assert.match(diffSource, /isWholeLine:\s*true/u);
});

test('shared stylesheet uses IDEA Light and Dark DIFF_CONFLICT backgrounds', () => {
  assert.match(cssSource, /\.dsh-editor-conflict-marker-line[\s\S]*?#ffd5cc/iu);
  assert.match(cssSource, /prefers-color-scheme:\s*dark[\s\S]*?\.dsh-editor-conflict-marker-line[\s\S]*?#45302b/iu);
});

test('the browser build registers the conflict marker model', () => {
  assert.match(buildSource, /components', 'diff', 'conflict-marker-model\.ts'/u);
  assert.match(buildSource, /conflictMarkerModelModule/u);
});
