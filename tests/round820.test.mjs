import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('RepositoryVersionPreview is a reusable read-only TSX diff component', async () => {
  const component = await read('src/client/components/diff/RepositoryVersionPreview.tsx');

  assert.match(component, /export interface RepositoryVersionPreviewProps/u);
  assert.match(component, /className='dsh-editor-repository-version'/u);
  assert.match(component, /data-dsh-repository-version-hash=\{hash\}/u);
  assert.match(component, /readOnly: true/u);
  assert.match(component, /fontSize: EDITOR_CODE_FONT_SIZE/u);
  assert.match(component, /lineHeight: EDITOR_CODE_LINE_HEIGHT/u);
  assert.match(component, /fontFamily: EDITOR_UI_FONT/u);
  assert.match(component, /version\?\.binary === true/u);
  assert.match(component, /t\('editor\.repositoryVersionBinary'\)/u);
  assert.match(component, /onClick=\{\(\) => onOpenLocal\?\.\(path\)\}/u);
  assert.match(component, /onClick=\{onClose\}/u);
  assert.doesNotMatch(component, /React\.createElement/u);
});

test('build embeds RepositoryVersionPreview and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/diff.ts');

  assert.match(build, /RepositoryVersionPreview\.tsx/u);
  assert.match(build, /repositoryVersionPreviewModule/u);
  assert.doesNotMatch(legacy, /function RepositoryVersionPreview\(/u);
});
