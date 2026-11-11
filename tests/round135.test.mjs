import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function styleBlock(name) {
  const start = source.indexOf(`      ${name}: {`);
  assert.notEqual(start, -1, `${name} is missing`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the folder icon cannot be squashed by flex', () => {
  /* The root row's folder svg measured 10x16 instead of 16x16: a flex child with an
     intrinsic aspect ratio gets its WIDTH squeezed. `flex: none` on the svg pins it. */
  const folder = source.slice(source.indexOf("case 'folder':"), source.indexOf("case 'file':"));
  assert.match(folder, /flex: 'none'|flexShrink: 0/);
});

test('folder icons are one step larger than file icons', () => {
  const entry = source.slice(source.indexOf('    function EntryIcon('), source.indexOf('/** Status color and compact label'));
  const folderSize = /name: entry\.root \? 'folderOpen' : expanded \? 'folderOpen' : 'folder', size: (\d+)/.exec(entry);
  assert.notEqual(folderSize, null);
  assert.ok(Number(folderSize[1]) >= 17, `folder icon ${folderSize[1]}px should be at least 17px`);
});

test('the tree label is one step larger than before', () => {
  const row = styleBlock('treeRow');
  const size = /fontSize: (\d+)/.exec(row);
  assert.notEqual(size, null);
  assert.ok(Number(size[1]) >= 13, `tree font ${size[1]}px should be at least 13px`);
});
