import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = client.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

function extractMarkdownImageResolver() {
  const resolveMarkdownLink = new Function(
    `function dirname(path) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index); }\n${extractFunction('resolveMarkdownLink')}\nreturn resolveMarkdownLink;`,
  )();
  const isImagePreviewPath = new Function(
    `${extractFunction('isImagePreviewPath')}\nreturn isImagePreviewPath;`,
  )();
  const markdownAssetRevisionForPath = new Function(
    `function dirname(path) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index); }\n${extractFunction('markdownAssetRevisionForPath')}\nreturn markdownAssetRevisionForPath;`,
  )();
  return new Function(
    'resolveMarkdownLink',
    'isImagePreviewPath',
    'markdownAssetRevisionForPath',
    'imagePreviewUrl',
    `${extractFunction('markdownWorkspaceImageUrl')}
return markdownWorkspaceImageUrl;`,
  )(
    resolveMarkdownLink,
    isImagePreviewPath,
    markdownAssetRevisionForPath,
    (path) => `api/dsh-editor/image?path=${encodeURIComponent(path)}`,
  );
}

test('Markdown relative images resolve through the workspace image route', () => {
  const imageUrl = extractMarkdownImageResolver();
  assert.equal(
    imageUrl('README.md', 'docs/home.png', '/workspace', 0, 'dsh-app://app/'),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png',
  );
  assert.equal(
    imageUrl('docs/guide.md', '../image.png', '/workspace', 0, 'dsh-app://app/'),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fimage.png',
  );
  assert.equal(
    imageUrl('docs/guide.md', 'assets/screen%20one.png#preview', '/workspace', 0, 'dsh-app://app/'),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fassets%2Fscreen+one.png',
  );
});

test('Markdown image resolution rejects external, escaping and non-image targets', () => {
  const imageUrl = extractMarkdownImageResolver();
  assert.equal(imageUrl('README.md', 'https://example.com/demo.png', '/workspace', 0, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', '#preview', '/workspace', 0, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', '../../../outside.png', '/workspace', 0, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', 'docs/notes.txt', '/workspace', 0, 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', 'docs/home.png', '', 0, 'dsh-app://app/'), undefined);
});

test('Markdown preview gives the host primitive the workspace image resolver', () => {
  const preview = client.slice(
    client.indexOf('function MarkdownPreviewPane('),
    client.indexOf('/**\n     * One file tab'),
  );
  assert.match(preview, /markdownWorkspaceImageUrl\(path, value, workspaceRoot, assetRevisions\)/u);
  assert.match(preview, /const pathImages = React\.useMemo\(/u);
  assert.match(preview, /React\.createElement\(MarkdownText, \{ text: content, labels, pathImages \}\)/u);
  assert.match(client, /workspaceRoot: root/u);
});
