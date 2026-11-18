import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const client = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const pathModelSource = await readFile(
  new URL('../src/client/components/editor/editor-path-model.ts', import.meta.url),
  'utf8',
);
const markdownPreviewSource = await readFile(
  new URL('../src/client/components/editor/MarkdownPreviewPane.tsx', import.meta.url),
  'utf8',
);
const markdownHelpers = loadTypeScriptModule(pathModelSource, [
  'resolveMarkdownLink',
  'isImagePreviewPath',
  'markdownAssetRevisionForPath',
  'markdownWorkspaceImageUrl',
  'nextMarkdownAssetRevisions',
]);

test('Markdown image URLs use only the revision for their containing directory', () => {
  const { markdownWorkspaceImageUrl: imageUrl } = markdownHelpers;

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
    imageUrl('README.md', 'docs/home.png', '/workspace', { global: 2, directories: { src: 7 } }, 'dsh-app://app/'),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png&v=2',
  );
  assert.equal(
    imageUrl('README.md', 'docs/home.png', '/workspace', { global: 0, directories: { src: 7 } }, 'dsh-app://app/'),
    'dsh-app://app/api/file?path=%2Fworkspace%2Fdocs%2Fhome.png',
  );
});

test('directory-specific workspace changes do not invalidate unrelated images', () => {
  const nextRevisions = markdownHelpers.nextMarkdownAssetRevisions;
  assert.deepEqual(nextRevisions({ global: 1, directories: { docs: 2, src: 4 } }, ['docs']), {
    global: 1,
    directories: { docs: 3, src: 4 },
  });
  assert.deepEqual(nextRevisions({ global: 1, directories: { docs: 2 } }, ['src']), {
    global: 1,
    directories: { docs: 2, src: 1 },
  });
  assert.deepEqual(nextRevisions({ global: 1, directories: { docs: 2 } }, null), {
    global: 2,
    directories: { docs: 2 },
  });
});

test('workspace file-change events update Markdown image revisions by directory', () => {
  const nextRevisions = markdownHelpers.nextMarkdownAssetRevisions;
  const initial = { global: 0, directories: {} };
  const afterDocs = nextRevisions(initial, ['docs']);
  assert.deepEqual(afterDocs, { global: 0, directories: { docs: 1 } });
  const afterSrc = nextRevisions(afterDocs, ['src']);
  assert.deepEqual(afterSrc, { global: 0, directories: { docs: 1, src: 1 } });
  assert.deepEqual(nextRevisions(afterSrc, null), {
    global: 1,
    directories: { docs: 1, src: 1 },
  });
});
