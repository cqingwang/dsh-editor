import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('MarkdownModeSwitch is a reusable TSX editor component', async () => {
  const component = await read('src/client/components/editor/MarkdownModeSwitch.tsx');

  assert.match(component, /export interface MarkdownModeSwitchProps/u);
  assert.match(component, /import type \{ MarkdownMode \} from '\.\/editor-document-model'/u);
  for (const mode of ['code', 'split', 'preview']) {
    assert.match(component, new RegExp(`id: '${mode}'`, 'u'));
  }
  assert.match(component, /role='group'/u);
  assert.match(component, /aria-pressed=\{mode === option\.id\}/u);
  assert.match(component, /data-dsh-markdown-mode=\{mode\}/u);
  assert.match(component, /<Icon[\s\S]*?size=\{13\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds MarkdownModeSwitch once and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/editor-core.ts');

  assert.match(build, /MarkdownModeSwitch\.tsx/u);
  assert.match(build, /markdownModeSwitchModule/u);
  assert.doesNotMatch(legacy, /function MarkdownModeSwitch\(/u);
});
