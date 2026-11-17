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
  return new Function(
    'resolveMarkdownLink',
    'isImagePreviewPath',
    'imagePreviewUrl',
    `${extractFunction('markdownWorkspaceImageUrl')}
return markdownWorkspaceImageUrl;`,
  )(
    resolveMarkdownLink,
    isImagePreviewPath,
    (path) => `api/dsh-editor/image?path=${encodeURIComponent(path)}`,
  );
}

test('Markdown relative images resolve through the workspace image route', () => {
  const imageUrl = extractMarkdownImageResolver();
  assert.equal(
    imageUrl('README.md', 'docs/home.png', 'dsh-app://app/'),
    'dsh-app://app/api/dsh-editor/image?path=docs%2Fhome.png',
  );
  assert.equal(
    imageUrl('docs/guide.md', '../image.png', 'dsh-app://app/'),
    'dsh-app://app/api/dsh-editor/image?path=image.png',
  );
  assert.equal(
    imageUrl('docs/guide.md', 'assets/screen%20one.png#preview', 'dsh-app://app/'),
    'dsh-app://app/api/dsh-editor/image?path=docs%2Fassets%2Fscreen%20one.png',
  );
});

test('Markdown image resolution rejects external, escaping and non-image targets', () => {
  const imageUrl = extractMarkdownImageResolver();
  assert.equal(imageUrl('README.md', 'https://example.com/demo.png', 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', '#preview', 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', '../../../outside.png', 'dsh-app://app/'), undefined);
  assert.equal(imageUrl('README.md', 'docs/notes.txt', 'dsh-app://app/'), undefined);
});

test('Markdown preview gives the host primitive the workspace image resolver', () => {
  const preview = client.slice(
    client.indexOf('function MarkdownPreviewPane('),
    client.indexOf('/**\n     * One file tab'),
  );
  assert.match(preview, /markdownWorkspaceImageUrl\(path, value\)/u);
  assert.match(preview, /const pathImages = React\.useMemo\(/u);
  assert.match(preview, /React\.createElement\(MarkdownText, \{ text: content, labels, pathImages \}\)/u);
});
