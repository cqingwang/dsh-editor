import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

function diffPreview() {
  const start = source.indexOf('function DiffPreview(');
  const end = source.indexOf('\n    function ', start + 10);
  assert.notEqual(start, -1, 'DiffPreview is missing');
  assert.notEqual(end, -1, 'DiffPreview end marker is missing');
  return source.slice(start, end);
}

const diffEditingEnabled = new Function(
  `${extractFunction('diffEditingEnabled')}; return diffEditingEnabled;`,
)();

test('editable diff respects IDEA Disable Editing without breaking read-only diffs', () => {
  assert.equal(diffEditingEnabled({ writable: true, swapped: false, locked: false }), true);
  assert.equal(diffEditingEnabled({ writable: true, swapped: false, locked: true }), false);
  assert.equal(diffEditingEnabled({ writable: true, swapped: true, locked: false }), false);
  assert.equal(diffEditingEnabled({ writable: false, swapped: false, locked: false }), false);
});

test('Diff exposes IDEA Disable Editing and locks Monaco plus gutter actions', () => {
  const diff = diffPreview();
  assert.match(diff, /const \[editLocked, setEditLocked\] = React\.useState\(false\)/);
  assert.match(diff, /id: 'disableEditing'/);
  assert.match(diff, /label: t\('editor\.diffDisableEditing'\)/);
  assert.match(diff, /active: editLocked/);
  assert.match(diff, /disabled: swapSides/);
  assert.match(diff, /run: \(\) => setEditLocked\(\(value\) => !value\)/);
  assert.match(diff, /readOnly: canEdit === false/);
  assert.match(diff, /renderMarginRevertIcon: canEdit/);
  assert.match(diff, /disabled: editLocked/);
});

test('Disable Editing wording exists in both dictionaries', () => {
  assert.ok(source.includes("diffDisableEditing: '禁用编辑'"));
  assert.ok(source.includes("diffDisableEditing: 'Disable Editing'"));
});
