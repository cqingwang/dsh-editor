import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/project/ProjectPanel.tsx', root), 'utf8');

test('directly typing in the Project tree opens the visible speed search', () => {
  const start = panel.indexOf('onTreeKeyDown={(event) => {');
  const end = panel.indexOf('onTreeContextMenu=', start);
  assert.ok(start >= 0 && end > start);
  const handler = panel.slice(start, end);

  assert.match(panel, /const directSpeedSearchRef = React\.useRef\(''\)/u);
  assert.match(handler, /event\.nativeEvent\.isComposing !== true/u);
  assert.match(handler, /event\.target\.closest\('input, textarea, select'\)/u);
  assert.match(handler, /event\.key\.length === 1 &&\s+!event\.metaKey &&\s+!event\.ctrlKey &&\s+!event\.altKey/u);
  assert.match(handler, /event\.preventDefault\(\);/u);
  assert.match(handler, /event\.stopPropagation\(\);/u);
  assert.match(handler, /const nextSearch = directSpeedSearchRef\.current \+ event\.key;/u);
  assert.match(handler, /directSpeedSearchRef\.current = nextSearch;/u);
  assert.match(handler, /setSearch\(nextSearch\);/u);
  assert.match(handler, /setSearchOpen\(true\);/u);
  assert.match(handler, /searchRef\.current\?\.focus\(\)/u);
  assert.match(panel, /onFocus=\{\(\) => \{\s*directSpeedSearchRef\.current = '';/u);
});
