import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('AnnotatePreview is a reusable TSX diff component', async () => {
  const component = await read('src/client/components/diff/AnnotatePreview.tsx');

  assert.match(component, /export interface AnnotatePreviewProps/u);
  assert.match(component, /className='dsh-editor-annotate-pane'/u);
  assert.match(component, /className='dsh-editor-annotate-gutter'/u);
  assert.match(component, /className='dsh-editor-annotate-code'/u);
  assert.match(component, /<CodePreviewCode[\s\S]*?text=\{annotateTextLines\[index\]/u);
  assert.match(component, /<button[\s\S]*?className='dsh-editor-annotate-gutter'/u);
  assert.match(component, /aria-label=\{`\$\{row\.author\}/u);
  assert.match(component, /<PathLabel/u);
  assert.match(component, /<ToolbarButton/u);
  assert.match(component, /t\('editor\.annotateMode'\)/u);
  assert.match(component, /t\('editor\.annotateTruncated'\)/u);
  assert.match(component, /t\('editor\.annotateOpenCommit'\)/u);
  assert.match(component, /onClick=\{\(\) => onOpenCommit\?\.\(row\.hash\)\}/u);
  assert.match(component, /selected === row\.hash/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds AnnotatePreview and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/diff.ts');

  assert.match(build, /AnnotatePreview\.tsx/u);
  assert.match(build, /annotatePreviewModule/u);
  assert.doesNotMatch(legacy, /function AnnotatePreview\(/u);
});
