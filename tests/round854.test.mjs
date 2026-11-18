import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorErrorBanner is a reusable TSX error surface', async () => {
  const component = await read('src/client/components/editor/EditorErrorBanner.tsx');

  assert.match(component, /export interface EditorErrorBannerProps/u);
  assert.match(component, /function EditorErrorBanner\(/u);
  assert.match(component, /if \(monacoError === null && editorError === null\) return null;/u);
  assert.match(component, /<div style=\{styles\.error\}>\{`\$\{monacoLabel\}: \$\{monacoError\}`\}<\/div>/u);
  assert.match(component, /<div style=\{styles\.error\}>\{editorError\}<\/div>/u);
  assert.match(component, /export \{ EditorErrorBanner \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds EditorErrorBanner and workspace reuses it', async () => {
  const build = await read('scripts/build-client.mjs');
  const workspace = await read('src/client/editor-workspace.tsx');
  const fixture = await read('tests/fixtures/editor-error-banner.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorErrorBanner\.tsx/u);
  assert.match(build, /editorErrorBannerModule/u);
  assert.doesNotMatch(workspace, /React\.createElement\('div', \{ style: styles\.error \}/u);
  assert.match(workspace, /<EditorErrorBanner/u);
  assert.match(workspace, /<EditorErrorBanner[\s\S]*?monacoLabel=\{t\('editor\.monacoError'\)\}/u);
  assert.match(fixture, /EDITOR_ERROR_BANNER_END/u);
  assert.match(client, /function EditorErrorBanner\(/u);
});
