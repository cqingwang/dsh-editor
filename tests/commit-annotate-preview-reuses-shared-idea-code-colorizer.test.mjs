import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/diff/AnnotatePreview.tsx', import.meta.url),
  'utf8',
);

test('Annotate reuses the shared Monaco preview colorizer', () => {
  assert.match(component, /useCodePreviewColorizedLines/u);
  assert.match(component, /annotateTextLines/u);
  assert.match(component, /target\?\.path \?\? ''/u);
});

test('Annotate renders every source row through CodePreviewCode', () => {
  assert.match(component, /import \{ CodePreviewCode \} from '\.\.\/commit\/CodePreviewCode';/u);
  assert.match(component, /<CodePreviewCode[\s\S]*?text=\{/u);
  assert.match(component, /html=\{annotateColorizedLines\?\.\[index\]/u);
  assert.doesNotMatch(component, />\s*\{row\.content === '' \? ' ' : row\.content\}\s*</u);
});
