import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));

function extractFunction(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

test('a whole line change can be converted into Monaco range mappings', () => {
  const change = {
    originalStartLineNumber: 2,
    originalEndLineNumber: 2,
    modifiedStartLineNumber: 2,
    modifiedEndLineNumber: 2,
    charChanges: [{
      originalStartLineNumber: 2,
      originalStartColumn: 1,
      originalEndLineNumber: 2,
      originalEndColumn: 8,
      modifiedStartLineNumber: 2,
      modifiedStartColumn: 1,
      modifiedEndLineNumber: 2,
      modifiedEndColumn: 15,
    }],
  };
  const { lineChangeRangeMappings } = new Function(`${extractFunction('selectedCharChanges')}\n${extractFunction('lineChangeRangeMappings')}\nreturn { lineChangeRangeMappings };`)();
  const ranges = lineChangeRangeMappings(change);
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].modifiedStartLineNumber, 2);
});

test('Diff exposes Apply Left Side with IDEA shortcut and writable guards', () => {
  assert.match(diff, /id: 'applyLeftSide'/);
  assert.match(diff, /label: t\('editor\.diffApplyLeftSide'\)/);
  assert.match(diff, /shortcut: '⌃⌘→'/);
  assert.match(diff, /disabled: diffUnavailable \|\| diffReadOnly \|\| swapSides \|\| editLocked/);
  assert.match(diff, /run: applyLeftSide/);
});

test('control-meta-right invokes Apply Left Side inside the diff surface', () => {
  assert.match(
    diff,
    /event\.ctrlKey &&\s+event\.metaKey &&\s+!event\.altKey &&\s+!event\.shiftKey &&\s+event\.key === 'ArrowRight'/u,
  );
  assert.match(diff, /event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+applyLeftSide\(\);/s);
});

test('Apply Left Side labels exist in both dictionaries', () => {
  assert.equal(source.split("diffApplyLeftSide: '从左侧应用更改'").length - 1, 1);
  assert.equal(source.split("diffApplyLeftSide: 'Apply Left Side'").length - 1, 1);
});
