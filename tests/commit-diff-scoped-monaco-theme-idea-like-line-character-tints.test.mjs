import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('the diff uses a scoped Monaco theme for IDEA-like line and character tints', () => {
  const start = source.indexOf('function ensureDiffTheme(monaco)');
  assert.notEqual(start, -1);
  const end = source.indexOf('\n    }', start) + '\n    }'.length;
  const theme = source.slice(start, end);
  assert.match(theme, /monaco\.editor\.defineTheme\(id/);
  assert.match(theme, /base,\s+inherit: true/);
  assert.match(theme, /diffEditor\.insertedLineBackground/);
  assert.match(theme, /diffEditor\.removedLineBackground/);
  assert.match(theme, /diffEditor\.insertedTextBackground/);
  assert.match(theme, /diffEditor\.removedTextBackground/);
  assert.match(theme, /diffEditorGutter\.insertedLineBackground/);
  assert.match(theme, /diffEditorGutter\.removedLineBackground/);
  assert.match(theme, /diffEditorOverview\.insertedForeground/);
  assert.match(theme, /diffEditorOverview\.removedForeground/);
  assert.match(source, /theme: ensureDiffTheme\(monaco\)/);
});

test('the scoped diff theme never leaks into the normal Monaco editor theme', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(diff, /createDiffEditor\(node, \{[\s\S]*?theme: ensureDiffTheme\(monaco\)/);
  assert.doesNotMatch(diff, /dsh-editor-diff-light[\s\S]{0,120}setTheme/);
});
