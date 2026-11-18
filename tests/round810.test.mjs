import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-path-model.ts');

function markdownImageResolver() {
  const resolveMarkdownLink = new Function(
    `${transpileTypeScriptFunction(model, 'dirname')}
${transpileTypeScriptFunction(model, 'resolveMarkdownLink')}
return resolveMarkdownLink;`,
  )();
  const isImagePreviewPath = loadTypeScriptFunction(model, 'isImagePreviewPath');
  const dirname = (path) => {
    const index = path.lastIndexOf('/');
    return index < 0 ? '' : path.slice(0, index);
  };
  const markdownAssetRevisionForPath = new Function(
    'dirname',
    `${transpileTypeScriptFunction(model, 'markdownAssetRevisionForPath')}
return markdownAssetRevisionForPath;`,
  )(dirname);
  const markdownWorkspaceImageUrl = new Function(
    'resolveMarkdownLink',
    'isImagePreviewPath',
    'markdownAssetRevisionForPath',
    `${transpileTypeScriptFunction(model, 'markdownWorkspaceImageUrl')}
return markdownWorkspaceImageUrl;`,
  )(resolveMarkdownLink, isImagePreviewPath, markdownAssetRevisionForPath);
  return markdownWorkspaceImageUrl;
}

test('editor path model recognises native images and builds image URLs', () => {
  const isImagePreviewPath = loadTypeScriptFunction(model, 'isImagePreviewPath');
  assert.equal(isImagePreviewPath('docs/home.png'), true);
  assert.equal(isImagePreviewPath('docs/photo.JPEG'), true);
  assert.equal(isImagePreviewPath('docs/notes.md'), false);

  const imagePreviewUrl = new Function(
    'currentSessionId',
    'currentEditorWorkspaceId',
    `${transpileTypeScriptFunction(model, 'imagePreviewUrl')}
return imagePreviewUrl;`,
  )(
    () => 'session-1',
    () => 'workspace-1',
  );
  const url = new URL(imagePreviewUrl('docs/home.png', 17), 'http://127.0.0.1/');
  assert.equal(url.pathname, '/api/dsh-editor/image');
  assert.equal(url.searchParams.get('sessionId'), 'session-1');
  assert.equal(url.searchParams.get('workspaceId'), 'workspace-1');
  assert.equal(url.searchParams.get('path'), 'docs/home.png');
  assert.equal(url.searchParams.get('version'), '17');
});

test('Markdown image revisions stay scoped to changed directories', () => {
  const nextRevisions = loadTypeScriptFunction(model, 'nextMarkdownAssetRevisions');
  assert.deepEqual(nextRevisions({ global: 1, directories: { docs: 2, src: 4 } }, ['docs']), {
    global: 1,
    directories: { docs: 3, src: 4 },
  });
  assert.deepEqual(nextRevisions({ global: 1, directories: { docs: 2 } }, null), {
    global: 2,
    directories: { docs: 2 },
  });
});

test('Markdown workspace images use the guarded workspace URL', () => {
  const imageUrl = markdownImageResolver();
  assert.equal(
    imageUrl(
      'README.md',
      'docs/home.png',
      '/workspace',
      { global: 2, directories: { docs: 10, src: 7 } },
      'dsh-app://app/',
    ),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png&v=12',
  );
  assert.equal(imageUrl('README.md', 'https://example.com/a.png', '/workspace', null, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', '../../../outside.png', '/workspace', null, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', 'docs/notes.md', '/workspace', null, 'dsh-app://app/'), undefined);
});

test('build embeds editor path model and removes all legacy definitions', async () => {
  const build = await read('scripts/build-client.mjs');
  const editorCore = await read('src/client/editor-core.ts');
  const domainCore = await read('tests/fixtures/legacy/domain-core.legacy.js');

  assert.match(build, /editor-path-model\.ts/u);
  assert.match(build, /editorPathModelModule/u);
  for (const name of [
    'imagePreviewUrl',
    'markdownAssetRevisionForPath',
    'nextMarkdownAssetRevisions',
    'markdownWorkspaceImageUrl',
  ]) {
    assert.doesNotMatch(editorCore, new RegExp(`function ${name}\\(`, 'u'));
  }
  assert.doesNotMatch(domainCore, /function isImagePreviewPath\(/u);
});
