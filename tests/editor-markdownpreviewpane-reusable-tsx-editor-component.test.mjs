import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('MarkdownPreviewPane is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/MarkdownPreviewPane.tsx');

  assert.match(component, /export interface MarkdownPreviewPaneProps/u);
  assert.match(component, /primitives\?\.MarkdownText/u);
  assert.match(component, /primitives\?\.MarkdownDelegateProvider/u);
  assert.match(
    component,
    /<MarkdownText[\s\S]*?text=\{content\}[\s\S]*?labels=\{labels\}[\s\S]*?pathImages=\{pathImages\}/u,
  );
  assert.match(component, /const resolved = resolveMarkdownLink\(path, target\);/u);
  assert.match(component, /window\.open\(target, '_blank', 'noopener,noreferrer'\)/u);
  assert.match(component, /data-dsh-markdown-preview-pane=''/u);
  assert.match(component, /data-dsh-markdown-link-error=''/u);
  assert.match(component, /openFile=\{openLocal\}/u);
  assert.match(component, /openExternalLink=\{openExternal\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds MarkdownPreviewPane once and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/editor-core.ts');

  assert.match(build, /MarkdownPreviewPane\.tsx/u);
  assert.match(build, /markdownPreviewPaneModule/u);
  assert.doesNotMatch(legacy, /function MarkdownPreviewPane\(/u);
});
