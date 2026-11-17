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

test('Markdown image URLs use only the revision for their containing directory', () => {
  const resolveMarkdownLink = new Function(
    `function dirname(path) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index); }\n${extractFunction('resolveMarkdownLink')}\nreturn resolveMarkdownLink;`,
  )();
  const isImagePreviewPath = new Function(
    `${extractFunction('isImagePreviewPath')}\nreturn isImagePreviewPath;`,
  )();
  const markdownAssetRevisionForPath = new Function(
    `function dirname(path) { const index = path.lastIndexOf('/'); return index < 0 ? '' : path.slice(0, index); }\n${extractFunction('markdownAssetRevisionForPath')}\nreturn markdownAssetRevisionForPath;`,
  )();
  const imageUrl = new Function(
    'resolveMarkdownLink',
    'isImagePreviewPath',
    'markdownAssetRevisionForPath',
    `${extractFunction('markdownWorkspaceImageUrl')}
return markdownWorkspaceImageUrl;`,
  )(resolveMarkdownLink, isImagePreviewPath, markdownAssetRevisionForPath);

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
  assert.equal(
    imageUrl(
      'README.md',
      'docs/home.png',
      '/workspace',
      { global: 2, directories: { src: 7 } },
      'dsh-app://app/',
    ),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png&v=2',
  );
  assert.equal(
    imageUrl(
      'README.md',
      'docs/home.png',
      '/workspace',
      { global: 0, directories: { src: 7 } },
      'dsh-app://app/',
    ),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png',
  );
});

test('directory-specific workspace changes do not invalidate unrelated images', () => {
  const nextRevisions = new Function(
    `${extractFunction('nextMarkdownAssetRevisions')}\nreturn nextMarkdownAssetRevisions;`,
  )();
  assert.deepEqual(
    nextRevisions({ global: 1, directories: { docs: 2, src: 4 } }, ['docs']),
    { global: 1, directories: { docs: 3, src: 4 } },
  );
  assert.deepEqual(
    nextRevisions({ global: 1, directories: { docs: 2 } }, ['src']),
    { global: 1, directories: { docs: 2, src: 1 } },
  );
  assert.deepEqual(
    nextRevisions({ global: 1, directories: { docs: 2 } }, null),
    { global: 2, directories: { docs: 2 } },
  );
});

test('workspace file-change events update Markdown image revisions by directory', () => {
  assert.match(client, /const \[markdownAssetRevisions, setMarkdownAssetRevisions\] = React\.useState\(\{ global: 0, directories: \{\} \}\)/u);
  assert.match(client, /const changedListings = await refreshTree\(/u);
  assert.match(client, /nextMarkdownAssetRevisions\(current, changedListings\)/u);
  assert.match(client, /keepUnchangedListing\(childrenRef\.current\[path\], rows\)/u);
  const markdown = client.slice(
    client.indexOf('function MarkdownPreviewPane('),
    client.indexOf('/**\n     * Render one image'),
  );
  assert.match(markdown, /assetRevisions/u);
  assert.match(markdown, /markdownWorkspaceImageUrl\(path, value, workspaceRoot, assetRevisions\)/u);
  assert.match(markdown, /\}\), \[path, workspaceRoot, assetRevisions\]\)/u);
  assert.match(client, /assetRevisions: markdownAssetRevisions/u);
});
