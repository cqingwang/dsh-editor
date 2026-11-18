import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findStart = source.lastIndexOf('function FindToolWindowView(');
const findEnd = source.indexOf('const FindToolWindow = FindToolWindowView;', findStart);
const find = source.slice(findStart, findEnd);

test('Find tool owns query and replacement input refs', () => {
  assert.match(find, /const queryInputRef = React\.useRef\(null\)/);
  assert.match(find, /ref=\{queryInputRef\}/);
  assert.match(find, /ref=\{replaceInputRef\}/);
});

test('Find history menus fall back to their matching input', () => {
  assert.match(
    find,
    /fallbackFocus:\s+kind === 'query'\s+\? \(\) => queryInputRef\.current\?\.focus\?\.\(\)\s+: \(\) => \(replaceInputRef\.current \?\? queryInputRef\.current\)\?\.focus\?\.\(\)/u,
  );
  assert.match(find, /fallbackFocus:\s+kind === 'query'/u);
});

test('Find result menu falls back to the query when its row unmounts', () => {
  assert.match(
    find,
    /const openFindResultMenuAt = \(\s*x(?::\s*[^,]+)?,\s*y(?::\s*[^,]+)?,\s*result(?::\s*[^)]+)?\)(?::\s*[^{]+)?/,
  );
  assert.match(find, /fallbackFocus: \(\) => queryInputRef\.current\?\.focus\?\.\(\)/);
  assert.doesNotMatch(find, /document\.body\.focus/);
});

test('handoff still restores the active descendant without taking focus early', () => {
  assert.match(find, /handoffReadyRevisionRef/);
  assert.match(find, /findToolHandoffTarget\(scopedFileResults, scopedMatches, state\.index, findGroupBy\)/);
  assert.match(find, /\[data-dsh-find-active="1"\]/);
  assert.match(find, /scrollIntoView/);
});
