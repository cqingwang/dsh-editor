import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const project = await read('src/client/project.ts');
const helpers = loadTypeScriptModule(project, [
  'WORKSPACE_UPLOAD_CHUNK_BYTES',
  'compactDirectoryExpansionPaths',
  'formatUploadBytes',
  'uploadDropFailureMessage',
  'uploadFailureIsRetryable',
  'uploadProgressPercent',
  'workspaceDropSegment',
]);

test('TypeScript Project upload helpers preserve drop and progress behavior', () => {
  assert.equal(helpers.WORKSPACE_UPLOAD_CHUNK_BYTES, 10 * 1024 * 1024);
  assert.equal(helpers.workspaceDropSegment('logo.png'), 'logo.png');
  assert.equal(helpers.workspaceDropSegment('../logo.png'), '');
  assert.equal(helpers.workspaceDropSegment('docs/logo.png'), '');
  assert.equal(helpers.workspaceDropSegment(''), '');
  assert.equal(helpers.uploadProgressPercent(0, 0), 0);
  assert.equal(helpers.uploadProgressPercent(1, 3), 33);
  assert.equal(helpers.uploadProgressPercent(200, 100), 100);
  assert.equal(helpers.formatUploadBytes(10 * 1024 * 1024), '10.0 MiB');
  assert.equal(helpers.uploadFailureIsRetryable({ status: 409 }), false);
  assert.equal(helpers.uploadFailureIsRetryable({ status: 503 }), true);
  assert.equal(
    helpers.uploadDropFailureMessage(
      { code: 'dsh-editor/upload-invalid-name', name: 'bad/name' },
      (key, params) => `${key}:${JSON.stringify(params)}`,
    ),
    'editor.uploadInvalidName:{"name":"bad/name"}',
  );
  assert.deepEqual(
    helpers.compactDirectoryExpansionPaths('src', {
      src: [{ path: 'src/lib', kind: 'directory' }],
      'src/lib': [{ path: 'src/lib/core.ts', kind: 'file' }],
    }),
    ['src', 'src/lib'],
  );
});
