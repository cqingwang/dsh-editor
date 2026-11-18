import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('QuickOpen is a reusable TSX search component', async () => {
  const component = await read('src/client/components/search/QuickOpen.tsx');

  assert.match(component, /export interface QuickOpenProps/u);
  assert.match(component, /role='dialog'/u);
  assert.match(component, /autoFocus=\{true\}/u);
  assert.match(component, /ArrowDown/u);
  assert.match(component, /ArrowUp/u);
  assert.match(component, /Enter/u);
  assert.match(component, /Escape/u);
  assert.match(component, /<EntryIcon/u);
  assert.match(component, /<GitStatusBadge/u);
  assert.match(component, /className='dsh-editor-palette-row'/u);
  assert.match(component, /t\('editor\.recentEmpty'\)/u);
  assert.match(component, /t\('editor\.noMatches'\)/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds QuickOpen and fuzzyScore without legacy duplicates', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/find-tool.ts');
  const quickOpen = await read('src/client/components/search/QuickOpen.tsx');

  assert.match(build, /QuickOpen\.tsx/u);
  assert.match(build, /quickOpenModule/u);
  assert.doesNotMatch(legacy, /function QuickOpen\(/u);
  assert.match(quickOpen, /function QuickOpen\(/u);
  assert.match(legacy, /function fuzzyScore\(/u);
});
